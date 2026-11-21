const name = process.env.MOD;
const a = require(name);
const b = import("./" + name);
const c = require("./ok");
module.exports = { a, b, c };
