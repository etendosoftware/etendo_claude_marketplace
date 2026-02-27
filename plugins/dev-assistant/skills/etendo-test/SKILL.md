---
description: "/etendo:test — Create Java unit tests for Etendo modules using JUnit 4 + Mockito 5 with Etendo-specific patterns"
argument-hint: "<class to test, e.g. 'MyEventHandler' or path>"
---

# /etendo:test — Create Java unit tests for Etendo modules

**Arguments:** `$ARGUMENTS` (e.g., "MyEventHandler", "com.mycompany.mymodule.process.MyProcess", or path to source file)

---

First, read `skills/etendo-_context/SKILL.md`.

## Step 1: Identify the source file

Find the Java file to test:
```bash
find modules/{javapackage}/src -name "{ClassName}.java" 2>/dev/null
```

Read it, analyze its public methods, dependencies, and the base class it extends.

## Step 2: Determine the test approach

| Source class extends/uses | Test base class | Runner |
|---|---|---|
| Simple logic, no DAL | None (plain test) | `@RunWith(MockitoJUnitRunner.class)` |
| OBDal, OBContext, DAL | `OBBaseTest` | Default |
| `@Inject`, CDI beans | `WeldBaseTest` | `@RunWith(Arquillian.class)` |

## Step 3: Write the test file

**File path:** `modules/{javapackage}/src-test/src/{package/path}/{ClassName}Test.java`

Mirror the source package structure under `src-test/src`.

### Test class structure

```java
package {same.package.as.source};

// Testing framework
import static org.junit.Assert.*;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;

// Mocking framework
import static org.mockito.Mockito.*;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.InjectMocks;
import org.mockito.junit.MockitoJUnitRunner;
import org.junit.runner.RunWith;

// Openbravo/Etendo
import org.openbravo.dal.service.OBDal;
import org.openbravo.dal.core.OBContext;

@RunWith(MockitoJUnitRunner.class)
public class {ClassName}Test {

  @Rule
  public ExpectedException expectedException = ExpectedException.none();

  // Static mocks (if DAL access needed)
  private MockedStatic<OBDal> mockedOBDal;
  private MockedStatic<OBContext> mockedOBContext;

  @Mock
  private OBDal mockOBDal;

  @InjectMocks
  private {ClassName} classUnderTest;

  @Before
  public void setUp() {
    mockedOBDal = mockStatic(OBDal.class);
    mockedOBDal.when(OBDal::getInstance).thenReturn(mockOBDal);

    mockedOBContext = mockStatic(OBContext.class);
  }

  @After
  public void tearDown() {
    if (mockedOBDal != null) mockedOBDal.close();
    if (mockedOBContext != null) mockedOBContext.close();
  }

  @Test
  public void testMethodName_HappyPath() {
    // Given
    when(mockDependency.method()).thenReturn(value);

    // When
    classUnderTest.methodUnderTest(params);

    // Then
    verify(mockDependency, times(1)).method();
    assertEquals(expected, actual);
  }

  @Test
  public void testMethodName_ExceptionCase() {
    expectedException.expect(OBException.class);
    expectedException.expectMessage("Expected error message");

    classUnderTest.methodThatThrows();
  }
}
```

### Method naming convention

```
test<MethodName>_<Scenario>
```
Examples: `testOnUpdate_NullMember`, `testExecute_EmptyList`, `testCalculateTotal_NegativeAmount`

## Etendo-specific mocking patterns

### OBDal + OBCriteria

```java
OBCriteria<MyEntity> mockCriteria = mock(OBCriteria.class);
when(mockOBDal.createCriteria(MyEntity.class)).thenReturn(mockCriteria);
when(mockCriteria.list()).thenReturn(Arrays.asList(mockEntity));
```

### OBContext setup (for OBBaseTest)

```java
@Before
public void setUp() {
  OBContext.setOBContext(TestConstants.Users.ADMIN,
      TestConstants.Roles.FB_GRP_ADMIN,
      TestConstants.Clients.FB_GRP,
      TestConstants.Orgs.ESP_NORTE);
}

@After
public void tearDown() {
  OBContext.restorePreviousMode();
}
```

### Monetary/BigDecimal assertions

```java
// Never use assertEquals for BigDecimal — use comparesEqualTo:
assertThat("Amount should match",
    actual.setScale(2, RoundingMode.HALF_UP),
    comparesEqualTo(expected.setScale(2, RoundingMode.HALF_UP)));
```

### Private field/method access

```java
// Set private field:
Field field = classUnderTest.getClass().getDeclaredField("fieldName");
field.setAccessible(true);
field.set(classUnderTest, mockValue);

// Invoke private method:
Method method = classUnderTest.getClass().getDeclaredMethod("methodName", String.class);
method.setAccessible(true);
Object result = method.invoke(classUnderTest, param1);
```

## Test coverage checklist

For each public method in the source class, create tests covering:

- **Happy path** — normal execution with valid inputs
- **Edge cases** — null inputs, empty lists, boundary values
- **Exception scenarios** — invalid inputs, missing data
- **Mock verifications** — verify DAL calls, save/flush operations
- **State changes** — verify entity setters were called correctly

## Step 4: Run the tests

```bash
JAVA_HOME=... ./gradlew test --tests "{package}.{ClassName}Test" > /tmp/test.log 2>&1
tail -20 /tmp/test.log
```

## Step 5: Result

```
+ Tests created for {ClassName}

  File: modules/{javapackage}/src-test/src/{path}/{ClassName}Test.java
  Test methods: {N}
  Coverage: happy path, edge cases, exceptions

  Run with:
    ./gradlew test --tests "{package}.{ClassName}Test"
```
