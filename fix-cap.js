const fs = require("fs");
const path = require("path");

function patchAllGradleFiles(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      patchAllGradleFiles(fullPath);
      continue;
    }

    if (file.endsWith(".gradle") || file.endsWith(".gradle.kts")) {
      let content = fs.readFileSync(fullPath, "utf8");
      let original = content;

      // Force Java 17
      content = content.replace(/JavaVersion\.VERSION_\d+/g, "JavaVersion.VERSION_17");

      // Remove ALL release options completely
      content = content.replace(/options\.release\s*=\s*\d+/g, "");

      // Fix Kotlin toolchain
      content = content.replace(/kotlin\.jvmToolchain\(\d+\)/g, "kotlin.jvmToolchain(17)");

      // Fix source/target compatibility variants
      content = content.replace(/sourceCompatibility\s*=\s*["']?\d+["']?/g, "sourceCompatibility = JavaVersion.VERSION_17");
      content = content.replace(/targetCompatibility\s*=\s*["']?\d+["']?/g, "targetCompatibility = JavaVersion.VERSION_17");

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log("✔ Patched:", fullPath);
      }
    }
  }
}

patchAllGradleFiles("android");
console.log("✔ All Gradle patches applied.");
