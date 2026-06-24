const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cwd = process.cwd();
const baseIgnoreFile = path.join(cwd, ".vscodeignore");
const localIgnoreFile = path.join(cwd, ".vscodeignore.local");

if (!fs.existsSync(baseIgnoreFile)) {
    console.error("Missing .vscodeignore");
    process.exit(1);
}

const mergedIgnoreFile = path.join(cwd, ".vscodeignore.local.merged");

try {
    const ignoreFiles = [baseIgnoreFile, localIgnoreFile].filter((filePath) => fs.existsSync(filePath));
    const mergedContent = ignoreFiles
        .map((filePath) => fs.readFileSync(filePath, "utf8").trim())
        .filter(Boolean)
        .join("\n");

    fs.writeFileSync(mergedIgnoreFile, `${mergedContent}\n`);

    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = spawnSync(command, ["exec", "vsce", "package", "--", "--ignoreFile", mergedIgnoreFile], {
        cwd,
        stdio: "inherit",
    });

    process.exit(result.status ?? 1);
} finally {
    fs.rmSync(mergedIgnoreFile, { force: true });
}
