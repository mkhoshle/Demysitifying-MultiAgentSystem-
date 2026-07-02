import { writeFileSync } from "node:fs";
import { join } from "node:path";

const clientDir = join(import.meta.dirname, "../../build/client");

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MAS Playground</title>
    <link rel="stylesheet" href="/assets/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), indexHtml);
console.log("Wrote build/client/index.html for Flask static serving");
