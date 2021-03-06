const plugins = require("./.vuepress/plugins.js");
import { writeFileSync } from "fs";

let bashDownload = `
set -x
set -e
`;

plugins.forEach(plugin => {
  const readmeUrl = plugin.readmeUrl ? plugin.readmeUrl : plugin.url.replace(
    /.+github.com(.+)\/tree(.+)$/,
    "https://raw.githubusercontent.com$1$2" + "/README.md"
  );
  const readmePath =
    "plugins/" + plugin.name.replace("/", "-").replace(/^@/, "") + ".md";

  bashDownload += `wget ${readmeUrl} -O ${readmePath}
`;

  // Add custom block for external plugins
  if (plugin.author !== 'Nomic Labs') {
    bashDownload += `echo -e "\n::: tip External Plugin\nThis is a third-party plugin. Please report issues in its [Github Repository](${plugin.url})\n:::\n\n$(cat ${readmePath})" > ${readmePath}
  `;
  }

  // Disable edit link for plugin pages
  bashDownload += `echo -e "---\neditLink: false\n---\n$(cat ${readmePath})" > ${readmePath}
`;

});

writeFileSync("wget-readmes.sh", bashDownload);
