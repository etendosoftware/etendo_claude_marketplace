---
description: "/etendo:test — Generate Java tests for Etendo modules with full coverage (unit, integration, parameterized). Supports EventHandlers, Webhooks, Processes, Callouts, DataSources, and plain logic."
argument-hint: "<class to test, e.g. 'MyEventHandler' or path to .java file>"
---

# /etendo:test — Generate Java tests for Etendo modules

**Arguments:** `$ARGUMENTS` (e.g., "MyEventHandler", "com.mycompany.mymodule.process.MyProcess", or path to source file)

---

First, read `skills/etendo-_guidelines/SKILL.md` and `skills/etendo-_context/SKILL.md`.

For complete testing patterns, base classes, and Mockito recipes, read `references/testing-guide.md`.

For DAL patterns, entity structure, and module layout, read `references/java-development.md`.

---

## Step 1: Find and analyze the source class

Find the Java file to test:
```bash
find modules/*/src -name "{ClassName}.java" 2>/dev/null
find src/ -name "{ClassName}.java" 2>/dev/null
```

Read the file completely. Analyze:
1. **All public and protected methods** — each needs at least one test
2. **Dependencies** — what does it import? What does it call statically?
3. **Base class** — determines the component type
4. **CDI annotations** — any `@Inject`?
5. **Error handling** — what exceptions does it throw?
6. **DAL usage** — direct `OBDal.getInstance()` calls? `OBCriteria`? `OBContext.setAdminMode()`?

## Step 2: Determine the test approach

### Component type detection

| Source class pattern | Component type |
|---|---|
| `extends EntityPersistenceEventObserver` | EventHandler |
| `extends BaseWebhookService` | Webhook |
| `extends DalBaseProcess` | Background Process |
| `extends BaseProcessActionHandler` | Action Process |
| `extends SimpleCallout` | Callout |
| `extends BaseDataSource` / `extends ReadOnlyDataSourceService` | DataSource |
| `@Inject` annotations present | CDI Bean |
| None of the above | Plain class |

### Base class and framework selection

Follow this decision tree (detailed in `references/testing-guide.md` Section 15):

```
Does the class use @Inject?
├── YES → WeldBaseTest + @RunWith(Arquillian.class) [JUnit 4]
├── NO
│   Does it need real DB access (rare for unit tests)?
│   ├── YES → OBBaseTest [JUnit 4]
│   ├── NO
│   │   Does it call OBDal/OBContext/OBProvider statically?
│   │   ├── YES → Plain test + MockedStatic
│   │   └── NO → Plain test + @Mock/@InjectMocks only
```

### JUnit version selection

Check the module's existing test convention:
```bash
# Check build.gradle for JUnit 5
grep -l "useJUnitPlatform" modules/{javapackage}/build.gradle 2>/dev/null
# Check existing tests
find modules/{javapackage}/src-test -name "*.java" -exec grep -l "org.junit.jupiter" {} \; 2>/dev/null
```

| Condition | Use |
|---|---|
| `build.gradle` has `useJUnitPlatform()` | JUnit 5 |
| Existing tests use `org.junit.jupiter` | JUnit 5 |
| Module extends OBBaseTest or WeldBaseTest | JUnit 4 (required) |
| No existing convention | JUnit 4 (safer default) |

## Step 3: Check for existing tests and constants

```bash
# Existing tests?
find modules/{javapackage}/src-test -name "*Test.java" 2>/dev/null
# Test constants?
find modules/{javapackage}/src-test -name "TestConstants.java" -o -name "*TestConstants.java" 2>/dev/null
# Test utilities?
find modules/{javapackage}/src-test -name "*TestUtil*.java" -o -name "*TestHelper*.java" 2>/dev/null
```

If a `TestConstants.java` exists in the module, read it and reuse its constants. If not and the test needs 3+ constants, create one.

## Step 4: Write the test file

**File path:** `modules/{javapackage}/src-test/src/{package/path}/{ClassName}Test.java`

Mirror the source package structure under `src-test/src/`.

### Template selection by component type

Use the appropriate template from `references/testing-guide.md`:
- **EventHandler** → Section 5.1
- **Webhook** → Section 5.2
- **Background/Action Process** → Section 5.3
- **Callout** → Section 5.4
- **DataSource** → Section 5.5
- **Plain class** → Section 3.1

### Mandatory elements for every test class

1. **Imports**: Use the correct JUnit version imports (never mix JUnit 4 and 5)
2. **MockedStatic cleanup**: If using MockedStatic, ALWAYS close in `@After`/`@AfterEach` with null checks
3. **Admin mode mocking**: If the source class uses `OBContext.setAdminMode()`, mock it as no-op
4. **OBCriteria chain**: If the source queries with OBCriteria, mock the full chain (add → setMaxResults → list/uniqueResult)

### Coverage targets — generate tests for:

For **each public method**, create tests covering:

| Category | Test method naming | What to verify |
|---|---|---|
| **Happy path** | `test{Method}_ValidInput` | Returns expected result, correct DAL calls |
| **Null parameter** | `test{Method}_NullParam` | Throws exception or handles gracefully |
| **Empty input** | `test{Method}_EmptyInput` | Correct default behavior |
| **Missing required data** | `test{Method}_MissingData` | Error response or exception |
| **Exception scenario** | `test{Method}_ThrowsOnInvalid` | Correct exception type and message |
| **State verification** | `test{Method}_SetsEntityFields` | Verify setters called with correct values |
| **DAL operations** | `test{Method}_SavesAndFlushes` | Verify save(), flush(), commitAndClose() |
| **Rollback on error** | `test{Method}_RollsBackOnError` | Verify rollbackAndClose() called |

### Component-specific tests to add

**EventHandler extra tests:**
- `testOnSave_ValidEvent` — handler processes when `isValidEvent` returns true
- `testOnUpdate_ChangedField` — handler reacts to specific field change
- `testOnSave_DuplicateCheck` — handler prevents duplicates (if applicable)

**Webhook extra tests:**
- `testGet_MissingRequiredParam_ReturnsError` — for each required parameter
- `testGet_SpecialCharactersInInput` — special chars don't break processing
- `testGet_ResponseContainsMessage` — success response has "message" key
- `testGet_ErrorResponseContainsError` — error response has "error" key

**Process extra tests:**
- `testDoExecute_NoRecordsToProcess` — handles empty query result
- `testDoExecute_BatchProcessing` — processes multiple records correctly
- `testDoExecute_ExceptionInLoop` — one record failure doesn't stop batch

**Callout extra tests:**
- `testExecute_SetsResultField` — verify `addResult()` called
- `testExecute_NullFieldValue` — handles null input parameter

### JUnit 4 structure template

```java
package {same.package.as.source};

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.InjectMocks;
import org.mockito.junit.MockitoJUnitRunner;

import org.openbravo.dal.service.OBDal;
import org.openbravo.dal.core.OBContext;

@RunWith(MockitoJUnitRunner.class)
public class {ClassName}Test {

    @Rule
    public ExpectedException expectedException = ExpectedException.none();

    @Mock private OBDal mockOBDal;
    // ... more mocks

    private MockedStatic<OBDal> obDalMock;
    private MockedStatic<OBContext> obContextMock;

    @InjectMocks
    private {ClassName} classUnderTest;

    @Before
    public void setUp() {
        obDalMock = mockStatic(OBDal.class);
        obContextMock = mockStatic(OBContext.class);
        obDalMock.when(OBDal::getInstance).thenReturn(mockOBDal);
        obContextMock.when(() -> OBContext.setAdminMode(anyBoolean())).thenAnswer(inv -> null);
        obContextMock.when(OBContext::restorePreviousMode).thenAnswer(inv -> null);
    }

    @After
    public void tearDown() {
        if (obDalMock != null) obDalMock.close();
        if (obContextMock != null) obContextMock.close();
    }

    @Test
    public void testMethodName_HappyPath() {
        // Given
        // When
        // Then
    }
}
```

### JUnit 5 structure template

```java
package {same.package.as.source};

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import org.openbravo.dal.service.OBDal;
import org.openbravo.dal.core.OBContext;

@ExtendWith(MockitoExtension.class)
class {ClassName}Test {

    @Mock private OBDal mockOBDal;
    // ... more mocks

    private MockedStatic<OBDal> obDalMock;
    private MockedStatic<OBContext> obContextMock;

    @InjectMocks
    private {ClassName} classUnderTest;

    @BeforeEach
    void setUp() {
        obDalMock = mockStatic(OBDal.class);
        obContextMock = mockStatic(OBContext.class);
        obDalMock.when(OBDal::getInstance).thenReturn(mockOBDal);
        obContextMock.when(() -> OBContext.setAdminMode(anyBoolean())).thenAnswer(inv -> null);
        obContextMock.when(OBContext::restorePreviousMode).thenAnswer(inv -> null);
    }

    @AfterEach
    void tearDown() {
        if (obDalMock != null) obDalMock.close();
        if (obContextMock != null) obContextMock.close();
    }

    @Test
    void testMethodName_HappyPath() {
        // Given
        // When
        // Then
    }
}
```

## Step 5: Verify the test compiles and passes

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "$JAVA_HOME") \
  ./gradlew test --tests "{package}.{ClassName}Test" > /tmp/etendo-test.log 2>&1
tail -20 /tmp/etendo-test.log
```

If compilation fails:
```bash
grep -E "\[ant:javac\]|error:|cannot find symbol" /tmp/etendo-test.log | head -20
```

Common fixes:
| Error | Cause | Fix |
|---|---|---|
| `cannot find symbol: OBBaseTest` | Missing test dependency | Ensure etendo-core is in dependencies |
| `cannot find symbol: MockedStatic` | Old Mockito version | Need mockito-core 4.x+ |
| `cannot find symbol: Entity` | Wrong import | Run `find build/etendo/src-gen -name "Entity.java"` |
| `useJUnitPlatform()` error | Missing Jupiter engine | Add `testRuntimeOnly 'org.junit.jupiter:junit-jupiter-engine'` |
| `Unresolved compilation` | Mixed JUnit 4/5 imports | Use only one JUnit version per test class |

If a test fails at runtime:
```bash
grep -A 5 "FAILED\|AssertionError\|Exception" /tmp/etendo-test.log | head -30
```

Fix assertions or mock setup, then re-run.

## Step 6: Result

```
+ Tests created for {ClassName}

  File: modules/{javapackage}/src-test/src/{path}/{ClassName}Test.java
  Framework: {JUnit 4|JUnit 5} + Mockito
  Test type: {Unit|Integration|CDI}
  Test methods: {N}
  Coverage: happy path, null/empty inputs, exceptions, state verification

  Run with:
    ./gradlew test --tests "{package}.{ClassName}Test"

  Next steps:
    ./gradlew test jacocoRootReport -> generate coverage report
    /etendo:smartbuild -> compile and deploy
```
