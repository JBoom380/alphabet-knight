"""Bundle three.core.js + three.module.js into one classic script that sets window.THREE."""
import os
import re

B = os.path.join(os.path.dirname(os.path.abspath(__file__)), "package", "build")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "three.global.js")

STMT = re.compile(r"^(import|export)\s*\{([^}]*)\}\s*(from\s*['\"][^'\"]+['\"])?\s*;?\s*$", re.M)
NL = "\n"


def pairs(body):
    out = []
    for item in body.split(","):
        item = item.strip()
        if item:
            m = re.match(r"(\w+)(?:\s+as\s+(\w+))?$", item)
            out.append((m.group(1), m.group(2) or m.group(1)))
    return out


def collect(src):
    exp, imp = {}, []
    for m in STMT.finditer(src):
        kind, body, frm = m.group(1), m.group(2), m.group(3)
        for first, second in pairs(body):
            if kind == "import":
                imp.append((first, second))
            elif not frm:
                exp[second] = first
    code = STMT.sub("", src)
    left = re.findall(r"^\s*(?:import|export)\b.*$", code, re.M)
    assert not left, left[:5]
    return code, exp, imp


def ret(exp):
    return "return {" + NL + ("," + NL).join(f"  {p}: {l}" for p, l in sorted(exp.items())) + NL + "};"


core_code, core_exp, _ = collect(open(os.path.join(B, "three.core.js"), encoding="utf-8").read())
mod_code, mod_exp, mod_imp = collect(open(os.path.join(B, "three.module.js"), encoding="utf-8").read())

destructure = "const { " + ", ".join(f"{a}: {b}" if a != b else a for a, b in mod_imp) + " } = __core;"
code = NL.join([
    "/* three.js r186.1, MIT License, Copyright 2010-2026 Three.js Authors. Bundled as a classic script. */",
    "window.THREE = (function () {",
    "'use strict';",
    "const __core = (function () {", core_code, ret(core_exp), "})();",
    "const __mod = (function () {", destructure, mod_code, ret(mod_exp), "})();",
    "return Object.freeze(Object.assign({}, __core, __mod));",
    "})();",
    "",
])
open(OUT, "w", encoding="utf-8").write(code)
print(len(core_exp) + len(mod_exp), "exports,", len(code), "bytes")
