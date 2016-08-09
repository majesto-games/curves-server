var exec = require('child_process').execSync
var lexec = function (command) {
  var out = exec(command).toString('utf8')
  console.log(out)
  return out
}

var startHash = exec("git rev-parse HEAD")
try {
  lexec("npm run docs")
} catch (e) {
  console.log(e.message)
}
try {
  lexec("git add docs -f && git commit -m \"dist subtree\"")
  var id = lexec("git subtree split --prefix docs master").trim()
  lexec("git push origin " + id + ":gh-pages --force")
} catch (e) {
  console.log(e.message)
}

lexec("git reset " + startHash)
