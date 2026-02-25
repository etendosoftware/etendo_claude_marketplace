# Publishing Etendo Modules to Nexus

Etendo modules are published as JAR files to a Nexus repository. Once published, they can be declared as Gradle dependencies — no more FTP/SSH transfers.

## Requirements

- Nexus access credentials (distributed with your license): username, password, repository name
- Module compatible with Etendo core ≥ 21Q3.2

---

## First-time publication

### 1. Generate build.gradle (if not already present)

```bash
./gradlew createModuleBuild --info -Ppkg=com.yourcompany.module -Prepo=<repo-name>
```

This reads `ad_module.xml` to populate the `group`, `artifact`, and `version`.

### 2. Register the module in Nexus

```bash
./gradlew registerModule --info -Ppkg=com.yourcompany.module -Prepo=<repo-name>
```

You will be prompted for Nexus username and password.

### 3. Add dependencies in build.gradle

```groovy
dependencies {
    // Etendo core range this module is compatible with
    implementation('com.etendoerp.platform:etendo-core:[22.1.0,23.0.0)')

    // Other Etendo module dependencies (must already be published to Nexus)
    implementation('com.somecompany.somemodule:somemodule:1.0.0')
}
```

### 4. Configure dependency injection (if using CDI/Weld)

Add to `build.gradle`:

```groovy
sourceSets {
    main {
        resources {
            srcDirs("etendo-resources")
        }
    }
}
```

Create `etendo-resources/META-INF/beans.xml`:

```xml
<beans xmlns="http://xmlns.jcp.org/xml/ns/javaee"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
           http://xmlns.jcp.org/xml/ns/javaee/beans_2_0.xsd"
       bean-discovery-mode="all" version="2.0">
</beans>
```

This is **required** for event handlers to be discovered at startup.

### 5. Build, export, and publish

```bash
./gradlew update.database smartbuild
./gradlew publishVersion -Ppkg=com.yourcompany.module
```

The module is compiled, packaged to JAR, and uploaded to Nexus.

---

## Subsequent versions

For follow-up releases, only the publish step is needed (module is already registered):

```bash
# 1. Export updated AD changes
./gradlew export.database -Dmodule=com.yourcompany.module

# 2. Bump version in ad_module.xml AND build.gradle

# 3. Publish
./gradlew publishVersion -Ppkg=com.yourcompany.module
```

---

## Module version source of truth

The version, group, and artifact come from `ad_module.xml`:

```xml
<AD_MODULE>
  <JAVAPACKAGE>com.yourcompany.module</JAVAPACKAGE>
  <VERSION>1.0.0</VERSION>
  ...
</AD_MODULE>
```

Keep `build.gradle` in sync with this version.

---

## Installing a published module

On the target environment, add to `build.gradle`:

```groovy
dependencies {
    implementation('com.yourcompany.module:module-artifact:1.0.0')
}
```

Then:

```bash
./gradlew update.database smartbuild
```

---

## Recommended workflow (GitFlow)

- `main` / `master` — stable released versions (tagged)
- `develop` — integration branch
- `feature/X` — feature branches
- Tag each release: `git tag v1.0.0`
- Version in `ad_module.xml` must match the tag
