# Etendo Testing Guide — Complete Reference

This document covers every test pattern used across Etendo core, modules_core, and extension modules. Use it as the authoritative reference when generating tests for any Etendo Java class.

---

## 1. Frameworks & Dependencies

Etendo uses two JUnit generations depending on the module age:

| Framework | Import prefix | Usage |
|---|---|---|
| **JUnit 4** | `org.junit.*` | Core, modules_core, older extension modules |
| **JUnit 5 (Jupiter)** | `org.junit.jupiter.api.*` | Newer extension modules (asyncprocess, reactor) |
| **Mockito 4.x+** | `org.mockito.*` | Both JUnit 4 and 5 (MockedStatic, MockedConstruction) |
| **Hamcrest** | `org.hamcrest.*` | Expressive assertions (core tests) |
| **Arquillian** | `org.jboss.arquillian.*` | CDI/Weld integration tests |

### build.gradle configuration

**JUnit 4 (default — no special config needed):**
```gradle
// Tests run automatically with default Gradle test task
// Dependencies inherited from etendo-core parent
```

**JUnit 5 (must opt-in):**
```gradle
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter-api:5.8.1'
    testRuntimeOnly 'org.junit.jupiter:junit-jupiter-engine:5.8.1'
}

test {
    useJUnitPlatform()
}
```

**Explicit Mockito (when not inherited):**
```gradle
dependencies {
    testImplementation 'org.mockito:mockito-core:5.+'
    testImplementation 'org.mockito:mockito-junit-jupiter:5.+'  // JUnit 5 only
}
```

---

## 2. Test File Location & Naming

### Directory structure

```
modules/{javapackage}/
├── src/                           # Production code
│   └── com/example/mymodule/
│       ├── eventhandler/
│       ├── process/
│       └── webhooks/
└── src-test/
    └── src/                       # Test code (mirrors production package)
        └── com/example/mymodule/
            ├── eventhandler/
            │   └── MyEventHandlerTest.java
            ├── process/
            │   └── MyProcessTest.java
            ├── webhooks/
            │   └── MyWebhookTest.java
            └── TestConstants.java  # Module-specific test constants
```

For core: `src-test/src/org/openbravo/test/...`

### Naming conventions

- **Test class**: `{ClassName}Test.java` — same package as the class under test
- **Test method (JUnit 4)**: `test<MethodName>_<Scenario>` — e.g., `testOnUpdate_NullMember`
- **Test method (JUnit 5)**: `<methodName><Scenario>` or `should<ExpectedBehavior>When<Condition>` — e.g., `actionSuccess()`, `shouldThrowWhenTemperatureInvalid()`
- **Test constants class**: `TestConstants.java` or `{Module}TestConstants.java`

---

## 3. Base Test Classes

### 3.1 No base class — Pure unit tests (most common for modules)

Use when the class under test has no direct DAL dependencies, or all DAL calls are mockable.

**JUnit 4:**
```java
@RunWith(MockitoJUnitRunner.class)
public class MyClassTest {
    @Mock private SomeDependency dep;
    @InjectMocks private MyClass classUnderTest;

    @Test
    public void testSomething() {
        when(dep.getValue()).thenReturn("x");
        assertEquals("x", classUnderTest.doWork());
    }
}
```

**JUnit 5:**
```java
@ExtendWith(MockitoExtension.class)
class MyClassTest {
    @Mock private SomeDependency dep;
    @InjectMocks private MyClass classUnderTest;

    @Test
    void testSomething() {
        when(dep.getValue()).thenReturn("x");
        assertEquals("x", classUnderTest.doWork());
    }
}
```

### 3.2 OBBaseTest — DAL integration tests

Use when the test needs real database access (OBDal, OBCriteria, entity CRUD).

**Location:** `org.openbravo.test.base.OBBaseTest`

**Key features:**
- Automatic DAL layer initialization in `@BeforeClass`
- Transaction management: auto-commit on pass, auto-rollback on fail
- Admin mode enforcement: throws if test leaves admin mode set
- Pre-configured test users, roles, orgs via `TestConstants`

```java
import org.openbravo.test.base.OBBaseTest;
import org.openbravo.test.base.TestConstants;
import org.openbravo.dal.core.OBContext;
import org.openbravo.dal.service.OBDal;
import static org.junit.Assert.*;

public class MyIntegrationTest extends OBBaseTest {

    @Before
    public void setUp() {
        super.setUp();
        OBContext.setOBContext(TestConstants.Users.ADMIN,
            TestConstants.Roles.FB_GRP_ADMIN,
            TestConstants.Clients.FB_GRP,
            TestConstants.Orgs.ESP_NORTE);
    }

    @Test
    public void testEntityCreation() {
        // Real DAL access available
        OBCriteria<Product> criteria = OBDal.getInstance().createCriteria(Product.class);
        criteria.setMaxResults(1);
        Product product = (Product) criteria.uniqueResult();
        assertNotNull(product);
    }

    @After
    public void tearDown() {
        OBContext.restorePreviousMode();
        super.tearDown();
    }
}
```

**Helper methods available:**
```java
setTestUserContext()                    // TEST_USER_ID
setTestAdminContext()                   // User 100 (admin)
setSystemAdministratorContext()         // User 0 (system)
setUserContext(String userId)           // Custom user
getRandomUser()                        // Random user from test client
addReadWriteAccess(Class<?> clz)       // Bypass entity access restrictions
count(Class<T> clz)                    // Count entity instances
getOneInstance(Class<T> clz)           // Get first entity or throw
commitTransaction()                    // Explicit commit
rollback()                             // Explicit rollback
```

**TestConstants available:**
```java
TestConstants.Users.ADMIN              // "100"
TestConstants.Users.SYSTEM             // "0"
TestConstants.Roles.FB_GRP_ADMIN
TestConstants.Roles.SYS_ADMIN
TestConstants.Roles.ESP_ADMIN
TestConstants.Clients.SYSTEM           // "0"
TestConstants.Clients.FB_GRP
TestConstants.Orgs.MAIN
TestConstants.Orgs.ESP
TestConstants.Orgs.ESP_NORTE
TestConstants.Orgs.ESP_SUR
TestConstants.Orgs.US
```

### 3.3 WeldBaseTest — CDI/Injection tests

Use when the class uses `@Inject` and needs a real CDI container.

**Location:** `org.openbravo.base.weld.test.WeldBaseTest` (extends OBBaseTest)

```java
import org.jboss.arquillian.junit.Arquillian;
import org.junit.runner.RunWith;
import org.openbravo.base.weld.test.WeldBaseTest;
import javax.inject.Inject;

@RunWith(Arquillian.class)
public class MyCDITest extends WeldBaseTest {

    @Inject
    private MyService myService;

    @Before
    @Override
    public void setUp() throws Exception {
        super.setUp();
        OBContext.setOBContext(TestConstants.Users.ADMIN,
            TestConstants.Roles.SYS_ADMIN,
            TestConstants.Clients.SYSTEM,
            TestConstants.Orgs.MAIN);
    }

    @Test
    public void testInjectedService() {
        assertNotNull(myService);
        String result = myService.process();
        assertNotNull(result);
    }

    @After
    public void tearDown() throws Exception {
        OBDal.getInstance().flush();
        OBDal.getInstance().commitAndClose();
    }
}
```

**When to use WeldBaseTest vs OBBaseTest:**
- Class has `@Inject` annotations → WeldBaseTest
- Class is a CDI bean discovered by Weld → WeldBaseTest
- Class uses only `OBDal.getInstance()` / static calls → OBBaseTest (simpler)

### 3.4 BaseDataSourceTestDal / BaseDataSourceTestNoDal — HTTP API tests

Use for testing DataSource REST API endpoints against a live Etendo instance.

```java
import org.openbravo.test.datasource.BaseDataSourceTestDal;

public class MyDataSourceTest extends BaseDataSourceTestDal {

    @Test
    public void testFetchRecords() throws Exception {
        // Login
        authenticate();

        // Make API request
        String response = doRequest(
            "/org.openbravo.service.datasource/Product",
            "{ \"_startRow\": 0, \"_endRow\": 10 }",
            200,  // expected HTTP status
            "POST"
        );

        JSONObject json = new JSONObject(response);
        assertTrue(json.has("response"));
    }
}
```

**Methods available:**
```java
doRequest(wsPart, content, expectedResponse, method)
doRequest(wsPart, params, expectedResponse, method)
authenticate()                   // Login with default admin/admin
getSessionCsrfToken()            // Get CSRF token
changeProfile(roleId, langId, orgId, warehouseId)
logout()
getOpenbravoURL()                // From Openbravo.properties
```

---

## 4. Mockito Patterns for Etendo

### 4.1 MockedStatic — Mocking OBDal, OBContext, OBProvider

**Critical pattern.** Almost every Etendo unit test needs to mock these static singletons.

**Pattern A: Instance variables with @Before/@After (multiple statics)**
```java
@RunWith(MockitoJUnitRunner.class)
public class MyTest {

    @Mock private OBDal mockOBDal;
    @Mock private OBContext mockOBContext;
    @Mock private OBProvider mockOBProvider;

    private MockedStatic<OBDal> obDalMock;
    private MockedStatic<OBContext> obContextMock;
    private MockedStatic<OBProvider> obProviderMock;

    @Before
    public void setUp() {
        obDalMock = mockStatic(OBDal.class);
        obContextMock = mockStatic(OBContext.class);
        obProviderMock = mockStatic(OBProvider.class);

        obDalMock.when(OBDal::getInstance).thenReturn(mockOBDal);
        obContextMock.when(OBContext::getOBContext).thenReturn(mockOBContext);
        obProviderMock.when(OBProvider::getInstance).thenReturn(mockOBProvider);

        // Prevent admin mode from failing
        obContextMock.when(() -> OBContext.setAdminMode(true)).thenAnswer(inv -> null);
        obContextMock.when(OBContext::restorePreviousMode).thenAnswer(inv -> null);
    }

    @After
    public void tearDown() {
        if (obDalMock != null) obDalMock.close();
        if (obContextMock != null) obContextMock.close();
        if (obProviderMock != null) obProviderMock.close();
    }
}
```

**Pattern B: Try-with-resources (single static, per-test)**
```java
@Test
public void testSomething() {
    try (MockedStatic<OBDal> obDalMock = mockStatic(OBDal.class)) {
        OBDal mockDal = mock(OBDal.class);
        obDalMock.when(OBDal::getInstance).thenReturn(mockDal);

        // test code
    }
    // MockedStatic auto-closed here
}
```

**Pattern A is preferred** when multiple tests need the same static mocks. Pattern B is cleaner for isolated cases.

### 4.2 OBCriteria chain mocking

```java
@SuppressWarnings("unchecked")
OBCriteria<MyEntity> mockCriteria = mock(OBCriteria.class);

// Setup the chain (each method returns the mock for fluent chaining)
when(mockOBDal.createCriteria(MyEntity.class)).thenReturn(mockCriteria);
when(mockCriteria.add(any())).thenReturn(mockCriteria);
when(mockCriteria.addOrderBy(any(), anyBoolean())).thenReturn(mockCriteria);
when(mockCriteria.setMaxResults(anyInt())).thenReturn(mockCriteria);
when(mockCriteria.setFilterOnReadableClients(anyBoolean())).thenReturn(mockCriteria);
when(mockCriteria.setFilterOnReadableOrganization(anyBoolean())).thenReturn(mockCriteria);

// Return data
when(mockCriteria.list()).thenReturn(Arrays.asList(mockEntity1, mockEntity2));
when(mockCriteria.uniqueResult()).thenReturn(mockEntity1);
when(mockCriteria.count()).thenReturn(5);
```

### 4.3 OBProvider mocking (entity creation)

```java
MyEntity mockEntity = mock(MyEntity.class);
when(mockOBProvider.get(MyEntity.class)).thenReturn(mockEntity);

// Verify setters were called
verify(mockEntity).setName("Expected Name");
verify(mockEntity).setActive(true);
verify(mockOBDal).save(mockEntity);
```

### 4.4 MockedConstruction — Constructor mocking

Use when the code under test creates objects with `new` that you can't inject.

```java
@Test
void testActionSuccess() {
    try (MockedConstruction<ActionResult> mockedConstruction =
             mockConstruction(ActionResult.class)) {
        // Code under test calls: new ActionResult()
        classUnderTest.execute(params);

        // Verify the constructed instance was configured
        assertEquals(1, mockedConstruction.constructed().size());
        ActionResult constructed = mockedConstruction.constructed().get(0);
        verify(constructed).setMessage("Success");
        verify(constructed).setType(Result.Type.SUCCESS);
    }
}
```

**With setup lambda:**
```java
try (MockedConstruction<InventoryCountProcess> mocked =
         Mockito.mockConstruction(InventoryCountProcess.class,
             (mock, context) -> {
                 when(mock.processInventory(any(), eq(false), eq(true)))
                     .thenReturn(successOBError);
             })) {
    webhook.get(parameters, responseVars);
}
```

### 4.5 ArgumentCaptor

```java
@Captor private ArgumentCaptor<String> clearingUseCaptor;

@Test
public void testUpdatePaymentMethod() {
    classUnderTest.updateConfig(mockFinAccount);

    verify(mockPaymentMethod).setOUTUponClearingUse(clearingUseCaptor.capture());
    assertEquals("CLE", clearingUseCaptor.getValue());
}
```

### 4.6 InOrder verification

```java
@Test
public void testSequentialOperations() {
    classUnderTest.process();

    InOrder inOrder = inOrder(mockDal, mockPaymentMethod);
    inOrder.verify(mockPaymentMethod).setName("Updated");
    inOrder.verify(mockDal).save(mockPaymentMethod);
    inOrder.verify(mockDal).flush();
}
```

### 4.7 Lenient stubbing

Use `lenient()` when a stub may not be used in every test but is part of shared setup:

```java
@Before
public void setUp() {
    lenient().when(mockEntity.getId()).thenReturn("123");
    lenient().when(mockEntity.getName()).thenReturn("Test");
}
```

---

## 5. Test Patterns by Component Type

### 5.1 EventHandler tests

EventHandlers observe `EntityNewEvent`, `EntityUpdateEvent`, `EntityDeleteEvent`.

```java
@RunWith(MockitoJUnitRunner.class)
public class MyEventHandlerTest {

    @Mock private EntityNewEvent newEvent;
    @Mock private EntityUpdateEvent updateEvent;
    @Mock private EntityDeleteEvent deleteEvent;
    @Mock private MyEntity targetEntity;
    @Mock private ModelProvider modelProvider;
    @Mock private OBDal obDal;

    private MockedStatic<ModelProvider> mockedModelProvider;
    private MockedStatic<OBDal> mockedOBDal;
    private MockedStatic<OBContext> mockedOBContext;

    // Override isValidEvent to always return true
    private MyEventHandler handler = new MyEventHandler() {
        @Override
        protected boolean isValidEvent(EntityPersistenceEvent event) {
            return true;
        }
    };

    @Before
    public void setUp() {
        mockedModelProvider = mockStatic(ModelProvider.class);
        mockedOBDal = mockStatic(OBDal.class);
        mockedOBContext = mockStatic(OBContext.class);

        mockedOBDal.when(OBDal::getInstance).thenReturn(obDal);
        mockedOBContext.when(() -> OBContext.setAdminMode(true)).thenAnswer(inv -> null);
        mockedOBContext.when(OBContext::restorePreviousMode).thenAnswer(inv -> null);

        when(newEvent.getTargetInstance()).thenReturn(targetEntity);
        when(updateEvent.getTargetInstance()).thenReturn(targetEntity);
    }

    @After
    public void tearDown() {
        mockedModelProvider.close();
        mockedOBDal.close();
        mockedOBContext.close();
    }

    @Test
    public void testOnSave_ValidData() {
        when(targetEntity.getName()).thenReturn("Valid");
        handler.onSave(newEvent);
        // No exception = success
    }

    @Test(expected = OBException.class)
    public void testOnUpdate_InvalidData() {
        when(targetEntity.getName()).thenReturn(null);
        handler.onUpdate(updateEvent);
    }
}
```

**Key patterns:**
- Anonymous subclass to override `isValidEvent()` → returns `true` always
- Mock `EntityNewEvent`/`EntityUpdateEvent` and their `getTargetInstance()`
- Mock admin mode calls to prevent NPEs
- Use `@Test(expected = ...)` or `ExpectedException` for validation tests

### 5.2 Webhook handler tests

Webhooks extend `BaseWebhookService` and implement `get(Map<String, String>, Map<String, String>)`.

```java
@ExtendWith(MockitoExtension.class)
class MyWebhookTest {

    @InjectMocks private MyWebhook webhook;
    @Mock private OBDal obDal;
    @Mock private OBProvider obProvider;

    private MockedStatic<OBDal> obDalMock;
    private MockedStatic<OBProvider> obProviderMock;
    private MockedStatic<OBContext> obContextMock;

    private Map<String, String> parameters;
    private Map<String, String> responseVars;

    @BeforeEach
    void setUp() {
        parameters = new HashMap<>();
        responseVars = new HashMap<>();

        obDalMock = mockStatic(OBDal.class);
        obProviderMock = mockStatic(OBProvider.class);
        obContextMock = mockStatic(OBContext.class);

        obDalMock.when(OBDal::getInstance).thenReturn(obDal);
        obProviderMock.when(OBProvider::getInstance).thenReturn(obProvider);
    }

    @AfterEach
    void tearDown() {
        obDalMock.close();
        obProviderMock.close();
        obContextMock.close();
    }

    @Test
    void testGet_ValidParameters_Success() {
        parameters.put("Name", "TestName");
        parameters.put("DBPrefix", "TST");
        setupSuccessScenario();

        webhook.get(parameters, responseVars);

        assertTrue(responseVars.containsKey("message"));
        assertFalse(responseVars.containsKey("error"));
        verify(obDal).save(any(MyEntity.class));
        verify(obDal).flush();
    }

    @Test
    void testGet_MissingName_Error() {
        parameters.put("DBPrefix", "TST");
        // Name is missing

        webhook.get(parameters, responseVars);

        assertTrue(responseVars.containsKey("error"));
        verify(obDal).rollbackAndClose();
    }

    @Test
    void testGet_NullPrefix_Error() {
        parameters.put("Name", "TestName");
        parameters.put("DBPrefix", null);

        webhook.get(parameters, responseVars);

        assertTrue(responseVars.containsKey("error"));
        assertEquals("Missing parameter, prefix cannot be null.",
            responseVars.get("error"));
    }

    private void setupSuccessScenario() {
        // OBCriteria chain mock
        OBCriteria<ModuleDBPrefix> mockCriteria = mock(OBCriteria.class);
        when(obDal.createCriteria(ModuleDBPrefix.class)).thenReturn(mockCriteria);
        when(mockCriteria.add(any())).thenReturn(mockCriteria);
        when(mockCriteria.setMaxResults(anyInt())).thenReturn(mockCriteria);
        when(mockCriteria.uniqueResult()).thenReturn(mock(ModuleDBPrefix.class));
    }
}
```

### 5.3 Background Process / Action Process tests

```java
@RunWith(MockitoJUnitRunner.class)
public class MyProcessTest {

    @Mock private OBDal mockDal;
    @Mock private ProcessBundle mockBundle;
    @Mock private OBContext mockContext;

    private MockedStatic<OBDal> mockedOBDal;
    private MockedStatic<OBContext> mockedOBContext;

    private MyProcess process;

    @Before
    public void setUp() {
        process = new MyProcess();
        mockedOBDal = mockStatic(OBDal.class);
        mockedOBContext = mockStatic(OBContext.class);
        mockedOBDal.when(OBDal::getInstance).thenReturn(mockDal);
    }

    @After
    public void tearDown() {
        mockedOBDal.close();
        mockedOBContext.close();
    }

    @Test
    public void testDoExecute_ProcessesRecords() throws Exception {
        OBCriteria<MyEntity> mockCriteria = mock(OBCriteria.class);
        when(mockDal.createCriteria(MyEntity.class)).thenReturn(mockCriteria);
        when(mockCriteria.add(any())).thenReturn(mockCriteria);

        MyEntity entity = mock(MyEntity.class);
        when(mockCriteria.list()).thenReturn(Arrays.asList(entity));

        process.doExecute(mockBundle);

        verify(entity).setProcessed(true);
        verify(mockDal).save(entity);
        verify(mockDal).flush();
    }
}
```

### 5.4 Callout tests

Callouts extend `SimpleCallout` and override `execute(CalloutInfo)`.

```java
@RunWith(MockitoJUnitRunner.class)
public class MyCalloutTest {

    @InjectMocks private MyCallout callout;
    @Mock private SimpleCallout.CalloutInfo mockInfo;

    @Before
    public void setUp() {
        when(mockInfo.getStringParameter("inpFieldName")).thenReturn("someValue");
    }

    @Test
    public void testExecute_SetsComputedField() throws Exception {
        callout.execute(mockInfo);
        verify(mockInfo).addResult("inpComputedField", "expectedResult");
    }

    @Test
    public void testExecute_WithStaticUtils() throws Exception {
        try (MockedStatic<MyUtils> utilsMock = mockStatic(MyUtils.class)) {
            callout.execute(mockInfo);
            utilsMock.verify(() -> MyUtils.compute("someValue"));
        }
    }
}
```

### 5.5 DataSource tests

DataSources extend `BaseDataSourceTestDal` and test REST API responses.

```java
public class MyDataSourceTest extends BaseDataSourceTestDal {

    @Test
    public void testFetchReturnsData() throws Exception {
        authenticate();
        String csrfToken = getSessionCsrfToken();

        Map<String, String> params = new HashMap<>();
        params.put("_operationType", "fetch");
        params.put("_startRow", "0");
        params.put("_endRow", "10");

        String response = doRequest(
            "/org.openbravo.service.datasource/MyDataSource",
            params, 200, "POST");

        JSONObject json = new JSONObject(response);
        JSONObject resp = json.getJSONObject("response");
        assertEquals(0, resp.getInt("status"));
        assertTrue(resp.getInt("totalRows") > 0);
    }
}
```

---

## 6. Parameterized Tests

### JUnit 4 — @RunWith(Parameterized.class)

```java
@RunWith(Parameterized.class)
public class MyParameterizedTest extends OBBaseTest {

    private final String testName;
    private final String inputValue;
    private final String expectedOutput;

    public MyParameterizedTest(String testName, String input, String expected) {
        this.testName = testName;
        this.inputValue = input;
        this.expectedOutput = expected;
    }

    @Parameters(name = "idx:{0} — {1}")
    public static Collection<Object[]> data() {
        return Arrays.asList(new Object[][] {
            { "basic", "input1", "output1" },
            { "edge_case_null", null, "default" },
            { "edge_case_empty", "", "default" },
            { "special_chars", "a&b<c", "a&amp;b&lt;c" },
        });
    }

    @Test
    public void testTransform() {
        assertEquals(expectedOutput, MyClass.transform(inputValue));
    }
}
```

### JUnit 4 — Enum-based parameters

```java
@RunWith(Parameterized.class)
public class SecurityTest extends BaseDataSourceTestDal {

    private enum TestCase {
        ADMIN_ROLE(TestConstants.Roles.FB_GRP_ADMIN, 200, true),
        NO_ACCESS_ROLE("NO_ACCESS_ROLE_ID", 401, false),
        SYSTEM_ROLE(TestConstants.Roles.SYS_ADMIN, 200, true);

        final String roleId;
        final int expectedStatus;
        final boolean canRead;

        TestCase(String roleId, int status, boolean canRead) {
            this.roleId = roleId;
            this.expectedStatus = status;
            this.canRead = canRead;
        }
    }

    @Parameters(name = "{0}")
    public static TestCase[] data() {
        return TestCase.values();
    }

    private final TestCase testCase;

    public SecurityTest(TestCase tc) {
        this.testCase = tc;
    }

    @Test
    public void testAccess() throws Exception {
        changeProfile(testCase.roleId, null, null, null);
        String resp = doRequest("/datasource", null, testCase.expectedStatus, "GET");
        // assertions based on testCase.canRead
    }
}
```

### JUnit 5 — @ParameterizedTest

```java
@ParameterizedTest
@ValueSource(strings = {"input1", "input2", "input3"})
void testWithValues(String input) {
    assertNotNull(processor.process(input));
}

@ParameterizedTest
@CsvSource({
    "input1, expected1",
    "input2, expected2",
    "'', default"
})
void testWithCsv(String input, String expected) {
    assertEquals(expected, processor.process(input));
}

@ParameterizedTest
@MethodSource("provideTestCases")
void testWithMethodSource(String input, int expected) {
    assertEquals(expected, processor.count(input));
}

static Stream<Arguments> provideTestCases() {
    return Stream.of(
        Arguments.of("abc", 3),
        Arguments.of("", 0),
        Arguments.of(null, 0)
    );
}
```

---

## 7. Exception Testing

### JUnit 4 — @Rule ExpectedException

```java
@Rule
public ExpectedException expectedException = ExpectedException.none();

@Test
public void testValidation_ThrowsOnInvalidData() {
    expectedException.expect(OBException.class);
    expectedException.expectMessage("Temperature must be between 0 and 2");

    when(entity.getTemperature()).thenReturn(new BigDecimal("2.1"));
    handler.onUpdate(updateEvent);
}
```

### JUnit 4 — @Test(expected = ...)

```java
@Test(expected = OBException.class)
public void testNullInput_ThrowsException() {
    classUnderTest.process(null);
}
```

### JUnit 5 — assertThrows

```java
@Test
void testInvalidInput_ThrowsException() {
    OBException exception = assertThrows(OBException.class, () -> {
        classUnderTest.process(null);
    });
    assertTrue(exception.getMessage().contains("cannot be null"));
}
```

---

## 8. Assertion Patterns

### Standard JUnit assertions

```java
assertEquals("message", expected, actual);
assertTrue("message", condition);
assertFalse("message", condition);
assertNotNull("message", object);
assertNull("message", object);
assertSame(expected, actual);
```

### Hamcrest matchers (preferred for complex assertions)

```java
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

assertThat(value, is(expected));
assertThat(value, not(nullValue()));
assertThat(list, hasSize(5));
assertThat(list, hasItems(item1, item2));
assertThat(list, empty());
assertThat(string, startsWith("prefix"));
assertThat(string, containsString("substring"));
assertThat(number, closeTo(expected, 0.001));    // For doubles
assertThat(bigDecimal, comparesEqualTo(expected)); // For BigDecimal
```

### BigDecimal assertions (important for financial calculations)

```java
// NEVER use assertEquals for BigDecimal (scale matters: 1.0 != 1.00)
// Use Hamcrest:
import static org.hamcrest.Matchers.comparesEqualTo;

assertThat("Amount should match",
    actual.setScale(2, RoundingMode.HALF_UP),
    comparesEqualTo(expected.setScale(2, RoundingMode.HALF_UP)));

// Or Hamcrest closeTo for tolerance:
assertThat(actual.doubleValue(), closeTo(expected.doubleValue(), 0.01));
```

### Mockito verifications

```java
verify(mock).method(args);                        // Called once
verify(mock, times(3)).method(args);              // Called exactly 3 times
verify(mock, never()).method(args);               // Never called
verify(mock, atLeastOnce()).method(args);          // Called at least once
verify(mock, atMost(5)).method(args);             // Called at most 5 times
verifyNoMoreInteractions(mock);                    // No unexpected calls

// With argument matchers
verify(mock).save(any(MyEntity.class));
verify(mock).process(eq("value"), anyInt());
verify(mock).setName(argThat(name -> name.startsWith("TEST")));
```

---

## 9. Admin Mode Pattern

**Critical**: Tests that use `OBContext.setAdminMode()` MUST restore it in a `finally` block. OBBaseTest enforces this — it throws `IllegalStateException` if admin mode is left set.

### In integration tests (OBBaseTest / WeldBaseTest)

```java
@Test
public void testPrivilegedOperation() {
    OBContext.setAdminMode(false);  // false = also bypass audit
    try {
        // Privileged operations here
        OBDal.getInstance().save(entity);
        OBDal.getInstance().flush();
    } finally {
        OBContext.restorePreviousMode();  // ALWAYS in finally
    }
}
```

### In unit tests (mocked)

```java
// Mock admin mode to be a no-op
mockedOBContext.when(() -> OBContext.setAdminMode(anyBoolean())).thenAnswer(inv -> null);
mockedOBContext.when(OBContext::restorePreviousMode).thenAnswer(inv -> null);
```

---

## 10. Transaction Patterns

### Implicit (OBBaseTest default)

```java
@Test
public void testSomething() {
    // Transaction auto-starts
    OBDal.getInstance().save(entity);
    // Transaction auto-commits if test passes, auto-rollbacks on failure
}
```

### Explicit commit

```java
@Test
public void testWithExplicitCommit() {
    OBDal.getInstance().save(entity);
    OBDal.getInstance().flush();           // Sync to DB within transaction
    OBDal.getInstance().commitAndClose();  // Finalize transaction
}
```

### Force rollback (even on success)

```java
@Test
public void testReadOnly() {
    // Ensure no side effects
    SessionHandler.getInstance().setDoRollback(true);
    // ... test code ...
    // Transaction will rollback regardless of test outcome
}
```

---

## 11. Test Data Patterns

### Module-specific TestConstants

```java
public final class TestConstants {
    private TestConstants() {
        throw new IllegalStateException("Utility class");
    }

    public static final String TEST_ENTITY_ID = "ABC123";
    public static final String TEST_NAME = "Test Entity";
    public static final String MESSAGE = "message";
    public static final String ERROR = "error";
    public static final String DB_PREFIX = "DBPrefix";
    // ... more constants
}
```

### TestUtility factory methods (core)

```java
// Available in org.openbravo.test.base.TestUtility
TestUtility.insertFinancialAccount(...)
TestUtility.insertPaymentMethod(...)
TestUtility.createNewOrder(...)
TestUtility.createNewInvoice(...)
TestUtility.processOrder(order)
TestUtility.processInvoice(invoice)
TestUtility.addPaymentFromInvoice(...)
TestUtility.setTestContext()
TestUtility.setTestContextSpain()
```

### RequestContext setup (for WeldBaseTest)

```java
@Before
public void setUp() throws Exception {
    super.setUp();
    OBContext.setOBContext(TestConstants.Users.ADMIN,
        TestConstants.Roles.SYS_ADMIN,
        TestConstants.Clients.SYSTEM,
        TestConstants.Orgs.MAIN);

    VariablesSecureApp vars = new VariablesSecureApp(
        OBContext.getOBContext().getUser().getId(),
        OBContext.getOBContext().getCurrentClient().getId(),
        OBContext.getOBContext().getCurrentOrganization().getId());
    RequestContext.get().setVariableSecureApp(vars);
}
```

---

## 12. Private Method/Field Access (Reflection)

Use sparingly — only when the class design doesn't allow testing otherwise.

```java
// Set private field
Field field = classUnderTest.getClass().getDeclaredField("fieldName");
field.setAccessible(true);
field.set(classUnderTest, mockValue);

// Invoke private method
Method method = classUnderTest.getClass().getDeclaredMethod("methodName", String.class);
method.setAccessible(true);
Object result = method.invoke(classUnderTest, "param1");
assertEquals("expected", result);
```

---

## 13. Log Assertion Pattern

OBBaseTest provides a `TestLogAppender` for asserting on log output:

```java
@Test
public void testLogsWarning() {
    setTestLogAppenderLevel(Level.WARN);

    classUnderTest.processWithWarning();

    // Check that a warning was logged
    TestLogAppender appender = getTestLogAppender();
    // (appender captures log events for assertion)
}
```

---

## 14. @Issue Annotation

Link tests to issue trackers:

```java
@Issue("27234")
@Test
public void testBugFix_27234() {
    // Regression test for issue 27234
}
```

---

## 15. Coverage Checklist

When generating tests for a class, create tests covering:

| Category | What to test |
|---|---|
| **Happy path** | Normal execution with valid inputs |
| **Null inputs** | Each parameter as null |
| **Empty inputs** | Empty strings, empty lists, empty maps |
| **Boundary values** | Min/max, zero, negative, BigDecimal precision |
| **Exception scenarios** | Invalid inputs, missing required data |
| **Mock verifications** | DAL save/flush/commit called correctly |
| **State changes** | Entity setters called with correct values |
| **Admin mode** | Properly entered and exited |
| **Error responses** | Error key present in response map |
| **Rollback scenarios** | rollbackAndClose called on errors |

### Decision matrix: which base to use

```
Does the class use @Inject?
├── YES → WeldBaseTest + @RunWith(Arquillian.class)
├── NO
│   Does the class need real DB access?
│   ├── YES → OBBaseTest
│   ├── NO
│   │   Does it call OBDal/OBContext statically?
│   │   ├── YES → Plain test + MockedStatic (Pattern A)
│   │   └── NO → Plain test + @Mock/@InjectMocks
```

### Decision matrix: JUnit 4 vs JUnit 5

```
Is the module's build.gradle configured with useJUnitPlatform()?
├── YES → JUnit 5 (@ExtendWith, @BeforeEach, @Test from jupiter)
├── NO
│   Does the module extend OBBaseTest or WeldBaseTest?
│   ├── YES → JUnit 4 (these base classes require JUnit 4)
│   └── NO → Check existing tests in the module for convention
│       └── No existing tests → JUnit 4 (safer default for Etendo)
```

---

## 16. Running Tests

### Single test class

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew test \
    --tests "com.example.mymodule.MyClassTest" \
    > /tmp/etendo-test.log 2>&1
tail -20 /tmp/etendo-test.log
```

### Single test method

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew test \
    --tests "com.example.mymodule.MyClassTest.testMethodName" \
    > /tmp/etendo-test.log 2>&1
```

### All tests in a module

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew test \
    --tests "com.example.mymodule.*" \
    > /tmp/etendo-test.log 2>&1
```

### With JaCoCo coverage report

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew test jacocoRootReport \
    > /tmp/etendo-test-coverage.log 2>&1
# Report at: build/reports/jacoco/jacocoRootReport/html/index.html
```

### Diagnosing failures

```bash
grep -E "FAILED|ERROR|Exception" /tmp/etendo-test.log | tail -30
# Full test report:
cat build/reports/tests/test/index.html
```
