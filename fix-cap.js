const fs = require("fs");
const path = require("path");

const androidDir = "android";
const appAssetsDir = path.join(androidDir, "app", "src", "main", "assets");

// ===============================================
// 1. FUNKCIJA ZA KOPIRANJE MANJKAJOČE DATOTEKE capacitor.js
// ===============================================
function copyCapacitorJs() {
  const sourcePath = path.join(
    __dirname,
    "node_modules",
    "@capacitor",
    "android",
    "assets",
    "web",
    "capacitor.js"
  );
  const destinationPath = path.join(appAssetsDir, "capacitor.js");

  // Preveri, ali ciljni imenik obstaja. Če ne, ga ustvari.
  if (!fs.existsSync(appAssetsDir)) {
    fs.mkdirSync(appAssetsDir, { recursive: true });
    console.log(`-> Created directory: ${appAssetsDir}`);
  }

  try {
    fs.copyFileSync(sourcePath, destinationPath);
    console.log(`✔ Kopirano: capacitor.js -> ${destinationPath}`);
  } catch (error) {
    console.error(
      "❌ KRITIČNA NAPAKA: Kopiranje capacitor.js neuspešno! Preverite, ali je @capacitor/android nameščen.",
      error
    );
  }
}

// ===============================================
// 2. FUNKCIJA ZA POPRAVEK GRADLE DATOTEK (Vaša originalna koda)
// ===============================================
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
      content = content.replace(
        /JavaVersion\.VERSION_\d+/g,
        "JavaVersion.VERSION_17"
      );

      // Remove ALL release options completely
      content = content.replace(/options\.release\s*=\s*\d+/g, "");

      // Fix Kotlin toolchain
      content = content.replace(
        /kotlin\.jvmToolchain\(\d+\)/g,
        "kotlin.jvmToolchain(17)"
      );

      // Fix source/target compatibility variants
      content = content.replace(
        /sourceCompatibility\s*=\s*["']?\d+["']?/g,
        "sourceCompatibility = JavaVersion.VERSION_17"
      );
      content = content.replace(
        /targetCompatibility\s*=\s*["']?\d+["']?/g,
        "targetCompatibility = JavaVersion.VERSION_17"
      );

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log("✔ Patched:", fullPath);
      }
    }
  }
}

// ===============================================
// GLAVNO IZVAJANJE
// ===============================================

// 1. Kopirajte manjkajoči capacitor.js
copyCapacitorJs();

// 2. Popravite Gradle datoteke
patchAllGradleFiles("android");
console.log("✔ All Gradle patches applied.");