import {
  BuidlerError,
  BuidlerPluginError,
  NomicLabsBuidlerPluginError,
} from "../core/errors";
import { isLocalDev } from "../core/execution-mode";
import { isRunningOnCiServer } from "../util/ci-detection";
import { getBuidlerVersion } from "../util/packageInfo";

import { getSubprocessTransport } from "./transport";

export const SENTRY_DSN =
  "https://38ba58bb85fa409e9bb7f50d2c419bc2@o385026.ingest.sentry.io/5224869";

/**
 * This class acts as a global singleton for reporting errors through Sentry.
 */
export class Reporter {
  public static reportError(error: Error) {
    const instance = Reporter._getInstance();

    if (!instance.enabled) {
      return;
    }

    if (!Reporter.shouldReport(error)) {
      return;
    }

    instance.init();

    const Sentry = require("@sentry/node");
    Sentry.setExtra("verbose", instance.verbose);
    Sentry.setExtra("configPath", instance.configPath);
    Sentry.setExtra("nodeVersion", process.version);

    const buidlerVersion = getBuidlerVersion();
    Sentry.setExtra("buidlerVersion", buidlerVersion);

    Sentry.captureException(error);

    return true;
  }

  /**
   * Enable or disable reporting. When disabled, all calls to `reportError` are
   * no-ops.
   */
  public static setEnabled(enabled: boolean) {
    const instance = Reporter._getInstance();
    instance.enabled = enabled;
  }

  /**
   * Enable or disable verbose output. This is necessary to pass the correct
   * environment variable to the transport subprocess.
   */
  public static setVerbose(verbose: boolean) {
    const instance = Reporter._getInstance();
    instance.verbose = verbose;
  }

  /**
   * The path to the buidler config file. We use this when files are anonymized,
   * since the buidler config is the only file in the user's project that is not
   * anonymized.
   */
  public static setConfigPath(configPath: string) {
    const instance = Reporter._getInstance();
    instance.configPath = configPath;
  }

  /**
   * Wait until all Sentry events were sent or until `timeout` milliseconds are
   * elapsed.
   *
   * This needs to be used before calling `process.exit`, otherwise some events
   * might get lost.
   */
  public static async close(timeout: number): Promise<boolean> {
    const instance = Reporter._getInstance();
    if (!instance.enabled || !instance.initialized) {
      return true;
    }

    const Sentry = await import("@sentry/node");
    return Sentry.close(timeout);
  }

  public static shouldReport(error: Error): boolean {
    if (
      BuidlerError.isBuidlerError(error) &&
      !error.errorDescriptor.shouldBeReported
    ) {
      return false;
    }

    if (BuidlerPluginError.isBuidlerPluginError(error)) {
      if (NomicLabsBuidlerPluginError.isNomicLabsBuidlerPluginError(error)) {
        return error.shouldBeReported;
      }

      // don't log errors from third-party plugins
      return false;
    }

    return true;
  }

  private static _instance: Reporter;

  private static _getInstance(): Reporter {
    if (this._instance === undefined) {
      this._instance = new Reporter();
    }

    return this._instance;
  }

  public enabled: boolean;
  public initialized = false;
  public verbose = false;
  public configPath?: string;

  private constructor() {
    this.enabled = true;
    if (isRunningOnCiServer()) {
      this.enabled = false;
    }

    // set BUIDLER_ENABLE_SENTRY=true to enable sentry during development (for local testing)
    if (isLocalDev() && process.env.BUIDLER_ENABLE_SENTRY === undefined) {
      this.enabled = false;
    }
  }

  public init() {
    if (this.initialized) {
      return;
    }

    const Sentry = require("@sentry/node");

    const linkedErrorsIntegration = new Sentry.Integrations.LinkedErrors({
      key: "parent",
    });

    Sentry.init({
      dsn: SENTRY_DSN,
      transport: getSubprocessTransport(),
      integrations: () => [linkedErrorsIntegration],
    });

    this.initialized = true;
  }
}
