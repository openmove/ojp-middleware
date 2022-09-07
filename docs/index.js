
const markdownpdf = require("markdown-pdf")

const mdDocs = [
'README.md',
'modules.md',
'services.md',
'config.md',
//
'api-ojp.md',
'api-otp.md',
'ep-manager.md',
]
, outPath = "../Documentation.pdf"

markdownpdf().concat.from(mdDocs).to(outPath, function () {
  console.log("Created", outPath)
});