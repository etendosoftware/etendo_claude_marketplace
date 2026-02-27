# Java Sonar Rules Reference for Etendo Development

Quality profile: **Futit** | Language: **Java** | Source: `Sonar-java-rules.xml`

This document lists all 489 SonarQube rules enforced in the Etendo Java quality profile,
organized by severity and type. Use it as a practical reference when writing or reviewing
Java code for Etendo modules.

## Summary

| Severity | Count |
|----------|------:|
| BLOCKER | 32 |
| CRITICAL | 101 |
| MAJOR | 219 |
| MINOR | 133 |
| INFO | 4 |
| **Total** | **489** |

| Type | Count |
|------|------:|
| Bug | 143 |
| Vulnerability | 31 |
| Security Hotspot | 37 |
| Code Smell | 278 |
| **Total** | **489** |

| Source | Count |
|--------|------:|
| Etendo custom rules | 8 |
| SonarQube Java rules | 481 |

---

## BLOCKER (32 rules)

These rules represent the most severe issues. Violations **must be fixed before merging**.
They indicate bugs that will crash at runtime, critical security vulnerabilities, or
code patterns that are fundamentally broken.

### Bug (12 rules)

#### `java:S2095` -- Resources should be closed

> Always close resources (streams, connections, readers) in a finally block or use try-with-resources. Unclosed resources cause memory leaks and connection pool exhaustion in Etendo's Tomcat server.

#### `java:S2168` -- Double-checked locking should not be used

> Double-checked locking is broken in Java unless the field is volatile. Use an enum singleton, holder-class idiom, or volatile + synchronized.

#### `java:S2189` -- Loops should not be infinite

> A loop that can never terminate (e.g., `while(true)` with no reachable break) will hang the request thread in Tomcat.

#### `java:S2229` -- Constructors should only call non-overridable methods

> Calling overridable methods from a constructor means subclasses see partially initialized state. Use final or private helper methods instead.

#### `java:S2236` -- Methods "wait()", "notify()" and "notifyAll()" should not be called on Thread instances

> Calling wait(), notify(), or notifyAll() on a Thread object can interfere with the JVM's thread lifecycle management.

#### `java:S2275` -- Printf-style format strings should not lead to unexpected behavior at runtime

> Mismatched printf-style format strings cause runtime exceptions (MissingFormatArgumentException). Always match format specifiers to arguments.

#### `java:S2276` -- "wait(...)" should be used instead of "Thread.sleep(...)" when a lock is held

> Calling Thread.sleep() while holding a lock blocks other threads. Use Object.wait() to release the lock while sleeping.

#### `java:S2689` -- "Boolean.TRUE" and "Boolean.FALSE" should be used instead of "Boolean" constructor

> Use Boolean.TRUE/FALSE constants instead of `new Boolean()`. The constructor is deprecated and wastes memory.

#### `java:S2695` -- "PreparedStatement" and "ResultSet" methods should be called with valid indices

> PreparedStatement and ResultSet indices are 1-based. Using index 0 throws SQLException at runtime.

#### `java:S3046` -- "synchronized" should not be used with "Condition"

> Using synchronized on a java.util.concurrent.locks.Condition mixes two incompatible locking paradigms.

#### `java:S3753` -- "@Controller" classes that use "@SessionAttributes" must call "setComplete" on their "SessionStatus" objects

> Spring @SessionAttributes require explicit SessionStatus.setComplete() call. Otherwise session attributes leak across requests.

#### `java:S4602` -- Members should not be both "final" and "volatile"

> A field that is both final and volatile is contradictory -- final fields are safely published without volatile.

### Vulnerability (4 rules)

#### `java:S2115` -- Databases should be password-protected

> Database connections must require a password. Passwordless DB access is a critical vulnerability in production.

#### `java:S2755` -- XML parsers should not be vulnerable to XXE attacks

> XML parsers must disable external entity processing (XXE). Set `XMLConstants.FEATURE_SECURE_PROCESSING` and disable DTDs.

#### `java:S6373` -- XML parsers should not be vulnerable to XXE attacks

> Same as S2755 -- disable external entities in all XML parser configurations (SAXParser, DocumentBuilder, etc.).

#### `java:S6437` -- Credentials should not be hard-coded

> Never hardcode credentials (passwords, API keys, tokens) in source code. Use environment variables or Etendo's secure configuration.

### Security Hotspot (2 rules)

#### `java:S2068` -- Hard-coded credentials are security-sensitive

> Hard-coded credentials (passwords, secrets) in source code are a critical security risk. Use configuration or vault services.

#### `java:S6418` -- Secrets should not be hard-coded

> Secrets (API keys, tokens) must not be committed to source code. Use environment variables or secure configuration.

### Code Smell (14 rules)

#### `java:S1190` -- Future keywords should not be used as names

> Do not use Java reserved keywords (like `var`, `record`, `sealed`) as identifiers. Code will break on newer Java versions.

#### `java:S1219` -- "switch" statements should not contain non-case labels

> Do not place non-case labels inside switch statements. This creates confusing control flow.

#### `java:S128` -- Switch cases should end with an unconditional "break" statement

> Every switch case must end with break, return, throw, or continue. Fall-through is a common source of bugs.

#### `java:S1845` -- Methods and field names should not differ only by capitalization

> Having methods/fields that differ only by case (e.g., `getValue` vs `getvalue`) causes confusion and potential bugs.

#### `java:S2178` -- Short-circuit logic should be used in boolean contexts

> Use && and || instead of & and | in boolean contexts. Non-short-circuit operators evaluate both sides, causing unexpected side effects or NPEs.

#### `java:S2187` -- TestCases should contain tests

> Test classes without test methods provide false confidence in code coverage.

#### `java:S2188` -- JUnit test cases should call super methods

> JUnit test cases must call super.setUp()/super.tearDown(). Missing calls skip framework initialization.

#### `java:S2387` -- Child class members should not shadow parent class members

> Child class fields should not shadow parent fields. This leads to subtle bugs where the wrong field is accessed.

#### `java:S2437` -- Silly bit operations should not be performed

> Bit operations on values that are always 0 or always have no effect are dead code and indicate a logic error.

#### `java:S2699` -- Tests should include assertions

> Every test method must contain at least one assertion. Tests without assertions never fail and provide no value.

#### `java:S2970` -- Assertions should be complete

> Assertions must be complete -- e.g., `assertThat(x)` without a terminal assertion method does nothing.

#### `java:S2975` -- "clone" should not be overridden

> Do not override clone(). Use copy constructors or factory methods instead, which are safer and more readable.

#### `java:S3014` -- Members of Spring components should be injected

> In Spring components, use @Autowired/@Inject instead of manually looking up beans.

#### `java:S3516` -- Methods should not return values from "finally" blocks

> Never return a value from a finally block. It silently swallows any exception thrown in the try/catch.

## CRITICAL (101 rules)

Critical rules catch serious bugs, security flaws, and code smells that significantly
impact reliability or maintainability. These should be addressed in every code review.

### Bug (24 rules)

#### `etendo-software:NoGlobalOBContextVariables` `[Etendo]` -- Do not use global OBContext variables

> Do not store OBContext in global/static variables. OBContext is request-scoped in Etendo and holding a reference causes cross-request contamination.

#### `etendo-software:RestorePreviousModeInFinally` `[Etendo]` -- Restore previous admin/cross-org mode in finally block

> When using OBContext.setAdminMode() or setCrossOrgReferenceAdminMode(), always restore the previous mode in a finally block to prevent privilege leaks.

#### `java:S1114` -- "serialVersionUID" should not be used on abstract classes

#### `java:S1143` -- "return" statements should not occur in "finally" blocks

> Returning from a finally block silently discards any pending exception. This masks real errors.

#### `java:S1175` -- The signature of "finalize()" should match that of "Object.finalize()"

> If finalize() has a different signature than Object.finalize(), it will not be called by the GC.

#### `java:S2119` -- "Random" objects should be reused

> Creating a new Random object per call defeats the purpose of pseudorandom generation. Reuse a single instance.

#### `java:S2122` -- "ScheduledThreadPoolExecutor" should not have 0 core threads

> ScheduledThreadPoolExecutor with 0 core threads will never execute scheduled tasks.

#### `java:S2151` -- "runFinalizersOnExit" should not be called

#### `java:S2222` -- Locks should be released

> Locks acquired but not released in a finally block cause permanent deadlocks.

#### `java:S2390` -- Classes with only "static" methods should not be instantiated

#### `java:S3518` -- Division or modulo by zero should not happen

> Division or modulo by zero throws ArithmeticException at runtime. Always validate the divisor.

#### `java:S4275` -- Getters and setters should access the expected fields

> Getters/setters that access the wrong field indicate copy-paste errors.

#### `java:S5779` -- Mocks should only be assigned once

#### `java:S5783` -- Only one assertion method should be invoked per @Test

#### `java:S5790` -- JUnit5 @Disabled annotation should provide a reason

#### `java:S5845` -- Test assertions should have the expected value on the correct side

#### `java:S5856` -- Regular expressions should be syntactically valid

> An invalid regex pattern causes PatternSyntaxException at runtime.

#### `java:S5994` -- "@EnableAutoConfiguration" should be fine-tuned

#### `java:S5996` -- "@SpringBootTest" should not use too many mocked beans

#### `java:S6001` -- Annotation target lists should not contain duplicate entries

#### `java:S6002` -- "@ParameterizedTest" should have a "@ValueSource" or equivalent

#### `java:S6104` -- Same annotation should not be repeated

#### `java:S6209` -- TestNG "@Test" annotations should not use "enabled" parameter

#### `etendo-software:SetAdminModeInTry` `[Etendo]` -- Set admin mode inside try block

> OBContext.setAdminMode(true) must be called inside a try block with the corresponding restorePreviousMode() in finally.

### Vulnerability (19 rules)

#### `java:S2053` -- Hashes should include an unpredictable salt

> Hashes must use unpredictable salts. Using constant or empty salts defeats the purpose of salting.

#### `java:S2254` -- "HttpServletRequest.getRequestedSessionId()" should not be used

#### `java:S2647` -- Basic authentication should not be used

#### `java:S3329` -- Cipher Block Chaining IVs should be unpredictable

#### `java:S4347` -- Secure random number generators should not output predictable values

#### `java:S4423` -- Weak SSL/TLS protocols should not be used

> SSLv3, TLS 1.0, and TLS 1.1 have known vulnerabilities. Use TLS 1.2+ only.

#### `java:S4426` -- Cryptographic keys should be robust enough

> Cryptographic keys shorter than recommended (RSA < 2048 bits, EC < 224 bits) are vulnerable to brute force.

#### `java:S4433` -- LDAP connections should be authenticated

#### `java:S4601` -- "@RequestMapping" methods should not be private

#### `java:S4684` -- Persistent entities should not be used as arguments of "@RequestMapping" methods

#### `java:S4830` -- Server certificates should be verified during SSL/TLS connections

> Always verify server certificates in SSL/TLS connections. Disabling verification allows man-in-the-middle attacks.

#### `java:S5344` -- Passwords should not be stored in plain-text or with a fast hashing algorithm

> Never store passwords in plain text. Use bcrypt, scrypt, or PBKDF2 with a high iteration count.

#### `java:S5445` -- "File.createTempFile" should not be used to create temporary directories

#### `java:S5527` -- Server hostnames should be verified during SSL/TLS connections

#### `java:S5542` -- Encryption algorithms should be used with secure mode and padding scheme

> Use AES/GCM or AES/CBC with HMAC. ECB mode and no-padding schemes are insecure.

#### `java:S5547` -- Cipher algorithms should be robust

> DES, 3DES, Blowfish, and RC4 are deprecated ciphers. Use AES-256.

#### `java:S5659` -- JWT should be signed and verified

> JWTs must be signed. Unsigned tokens (alg:none) can be forged by anyone.

#### `java:S5876` -- Session fixation attacks should be prevented

#### `java:S6432` -- Calling "HttpServletRequest.getInputStream()" and "HttpServletRequest.getReader()" multiple times is unreliable

### Security Hotspot (14 rules)

#### `java:S2245` -- Using pseudorandom number generators (PRNGs) is security-sensitive

#### `java:S2257` -- Using non-standard cryptographic algorithms is security-sensitive

#### `java:S4502` -- Disabling CSRF protections is security-sensitive

#### `java:S4512` -- Setting JavaBean properties is security-sensitive

#### `java:S4544` -- Using unsafe Jackson deserialization configuration is security-sensitive

#### `java:S4790` -- Using weak hashing algorithms is security-sensitive

#### `java:S4792` -- Configuring loggers is security-sensitive

#### `java:S5042` -- Expanding archive files without controlling resource consumption is security-sensitive

#### `java:S5320` -- Broadcasting intents is security-sensitive

#### `java:S5322` -- Using publicly writable directories is security-sensitive

#### `java:S5324` -- External content providers should require permissions

#### `java:S5332` -- Using clear-text protocols is security-sensitive

#### `java:S5443` -- Using publicly writable directories is security-sensitive

#### `java:S5852` -- Using slow regular expressions is security-sensitive

### Code Smell (44 rules)

#### `etendo-software:NoCriteriaListForUniqueRule` `[Etendo]` -- Do not call list() on OBCriteria when a unique result is expected

> When expecting a single result from OBCriteria, use uniqueResult() instead of list().get(0). This prevents index-out-of-bounds errors and is more efficient.

#### `etendo-software:NoListMethodsInLoopClause` `[Etendo]` -- Do not call list methods in loop conditions

> Calling list() or size() in a for/while condition re-executes the query on every iteration. Store the result in a variable before the loop.

#### `java:S1113` -- "Object.finalize()" should remain protected when overriding

#### `java:S115` -- Constant names should comply with a naming convention

#### `java:S1163` -- Exceptions should not be thrown in finally blocks

#### `java:S1174` -- "Object.finalize()" should not be called

#### `java:S1186` -- Methods should not be empty

> Empty methods are confusing. If intentionally empty, add a comment explaining why.

#### `java:S1192` -- String literals should not be duplicated

> Duplicated string literals should be extracted to constants. Reduces typo risk and makes changes easier.

#### `java:S1214` -- Constants should not be defined in interfaces

#### `java:S1215` -- "System.gc()" and "Runtime.gc()" should not be called

#### `java:S131` -- "switch" statements should have "default" clauses

> Switch statements should have a default clause to handle unexpected values explicitly.

#### `java:S1452` -- Generic wildcard types should not be used in return types

> Returning wildcard types (List<?>) from public methods forces callers to use raw types or unsafe casts.

#### `java:S1598` -- Package declaration should match source file directory

#### `java:S1948` -- Fields in a "Serializable" class should either be transient or serializable

> All fields in Serializable classes must be serializable or transient. Non-serializable fields cause NotSerializableException.

#### `java:S1994` -- "for" loop increment clauses should modify the loops' counters

#### `java:S2062` -- "Comparator.compare()" should not return "Comparator.compare()"

#### `java:S2093` -- Try-with-resources should be used

> Use try-with-resources for AutoCloseable resources. This guarantees cleanup even when exceptions occur.

#### `java:S2157` -- "Cloneables" should implement "clone"

#### `java:S2176` -- Class names should not shadow interfaces or superclasses

#### `java:S2186` -- JUnit assertions should not be used in "run" methods

#### `java:S2208` -- Wildcard imports should not be used

#### `java:S2235` -- IllegalArgumentException should not be thrown without a message or cause

#### `java:S2274` -- "Object.wait(...)" and "Condition.await(...)" should be called inside a "while" loop

> Object.wait() can wake spuriously. Always call it inside a while loop that checks the condition.

#### `java:S2447` -- Null should not be returned from a "Boolean" method

#### `java:S2479` -- Whitespace and control characters in string literals should be explicit

#### `java:S2638` -- Methods with "@NonNull" parameters should be overridden properly

#### `java:S2692` -- "indexOf" checks should not be for positive numbers

> indexOf() returns -1 when not found. Checking `> 0` instead of `>= 0` or `!= -1` misses matches at index 0.

#### `java:S2696` -- Instance methods should not write to "static" fields

> Instance methods writing to static fields cause race conditions in multi-threaded environments like Tomcat.

#### `java:S3252` -- Static members should be accessed through the class, not instances

#### `java:S3305` -- Fields in non-static inner classes should not be "@Autowired"

#### `java:S3776` -- Cognitive Complexity of methods should not be too high

> Methods with high cognitive complexity are hard to understand and maintain. Refactor into smaller, well-named methods.

#### `java:S3972` -- Conditionals should start on new lines

> An if/else following another if on the same line suggests a missing else-if. Use proper indentation.

#### `java:S3973` -- Conditionals should start on new lines

#### `java:S4454` -- Calls to "Thread.start()" should not be in constructors

#### `java:S4524` -- "default" clauses should be last

> The default clause should always be the last clause in a switch for readability.

#### `java:S4635` -- String operations with indexOf should use an appropriate overload

#### `java:S4970` -- Non-empty switch cases should end with an unconditional break

#### `java:S5361` -- "String#replace" should be preferred to "String#replaceAll"

> Use String.replace() instead of String.replaceAll() when you do not need regex. replaceAll() compiles a regex pattern.

#### `java:S5803` -- "private" methods only called by test code should be moved to test sources

#### `java:S5826` -- "Serializable" classes should not have side effects in "readObject"

#### `java:S5846` -- Test methods should not be annotated with both @Test and @Disabled

#### `java:S5969` -- Tests should be stable

#### `etendo-software:UseStringBuilderInsteadOfConcat` `[Etendo]` -- Use StringBuilder instead of string concatenation

> String concatenation with + in loops creates many intermediate String objects. Use StringBuilder for concatenation in loops or methods with many concatenations.

#### `etendo-software:UseStringUtilsWhenPossible` `[Etendo]` -- Use StringUtils methods when possible

> Use Apache StringUtils for null-safe string operations (isEmpty, isBlank, equals, etc.) instead of manual null checks.

## MAJOR (219 rules)

Major rules enforce good coding practices. While not immediately dangerous, violations
accumulate technical debt and make the codebase harder to maintain.

### Bug (87 rules)

| Rule | Description |
|------|-------------|
| `java:S1111` | Return value of "toString" should not be cast to unrelated type |
| `java:S1201` | Methods named "hashCode" should not accept parameters |
| `java:S1217` | "Thread.run()" should not be called directly |
| `java:S1221` | Methods named "equals" should override Object.equals(Object) |
| `java:S1317` | "StringBuilder" and "StringBuffer" should not be instantiated with a character |
| `java:S1656` | Variables should not be self-assigned |
| `java:S1751` | Loops with at most one iteration should be refactored |
| `java:S1764` | Identical expressions should not be used on both sides of a binary operator |
| `java:S1849` | "Iterator.hasNext()" should not call "Iterator.next()" |
| `java:S1860` | Synchronization should not be based on Strings or boxed primitives |
| `java:S1862` | Related "if-else-if" and "switch-case" statements should not have the same condition |
| `java:S1872` | Classes should not be compared by name |
| `java:S2060` | Non-primitive fields should not be "volatile" |
| `java:S2061` | Custom serialization method signatures should meet requirements |
| `java:S2109` | Reflection should not be used to check non-runtime annotations |
| `java:S2110` | Invalid "Date" values should not be used |
| `java:S2111` | "BigDecimal(double)" should not be used |
| `java:S2114` | Collections should not be passed as arguments to their own methods |
| `java:S2116` | "hashCode" and "toString" should not be called on array instances |
| `java:S2118` | Non-serializable objects should not be stored in "javax.servlet.http.HttpSession" |
| `java:S2121` | Silly equality checks should not be made |
| `java:S2123` | Values should not be uselessly incremented |
| `java:S2127` | "Double.longBitsToDouble" should not be used for "int" |
| `java:S2134` | Classes extending java.lang.Thread should override the "run" method |
| `java:S2142` | "InterruptedException" and "ThreadDeath" should not be ignored |
| `java:S2154` | Dissimilar primitive wrappers should not be used with the ternary operator |
| `java:S2159` | Silly equality checks should not be made |
| `java:S2175` | Inappropriate "Collection" calls should not be made |
| `java:S2177` | Child class methods named for parent class methods should be overrides |
| `java:S2201` | Return values from functions without side effects should not be ignored |
| `java:S2204` | ".equals()" should not be used to test the values of "Atomic" classes |
| `java:S2225` | "toString()" and "clone()" methods should not return null |
| `java:S2226` | Servlet methods should not have empty implementations |
| `java:S2230` | Non-public methods should not be decorated with "@Transactional" |
| `java:S2251` | A "for" loop update clause should move the counter in the right direction |
| `java:S2252` | Loop conditions should be true at least once |
| `java:S2259` | Null pointers should not be dereferenced |
| `java:S2273` | "wait(...)", "notify()" and "notifyAll()" methods should only be called when a lock is obviously held on an object |
| `java:S2441` | Non-serializable objects should not be stored in "javax.servlet.http.HttpSession" |
| `java:S2445` | Blocks should be synchronized on "private final" fields |
| `java:S2446` | "notifyAll" should be used |
| `java:S2583` | Conditionally executed code should be reachable |
| `java:S2639` | "Matcher.group(...)" should only be used after a successful "find()" |
| `java:S2677` | "read" and "readLine" return values should be used |
| `java:S2757` | "=+" should not be used instead of "+=" |
| `java:S2761` | "!" should not be used with "instanceof" |
| `java:S2789` | "null" should not be used with "Optional" |
| `java:S2885` | "Calendars" and "DateFormats" should not be static |
| `java:S2886` | "Getters" and "Setters" should be synchronized in pairs |
| `java:S3034` | Raw byte values should not be used in bitwise operations with shifts |
| `java:S3039` | String function calls that don't change string content should be removed |
| `java:S3064` | "=+" should not be used instead of "+=" |
| `java:S3065` | "Throwable.addSuppressed" should not be called in "finally" blocks |
| `java:S3067` | "getClass" should not be used for synchronization |
| `java:S3078` | "volatile" variables should not be used with compound operators |
| `java:S3346` | Assertions should not contain side effects |
| `java:S3436` | "@Test" methods should not declare parameters |
| `java:S3551` | "@Override" should be used on overriding and implementing methods |
| `java:S3655` | Optional value should only be accessed after calling isPresent() |
| `java:S3923` | All branches in a conditional structure should not have exactly the same implementation |
| `java:S3958` | Intermediate Stream methods should not be left unused |
| `java:S3959` | Consumed Stream pipelines should not be reused |
| `java:S3981` | Collection sizes and array length comparisons should make sense |
| `java:S3984` | Exception should not be created without being thrown |
| `java:S3986` | Day of week values should be used correctly |
| `java:S4143` | Collection elements should not be replaced unconditionally |
| `java:S4348` | "Iterator.next()" methods should throw "NoSuchElementException" |
| `java:S4351` | "equals" method should be overridden in records with arrays as members |
| `java:S4517` | "Number.intValue()" should not be used for null check |
| `java:S4973` | Strings and boxed types should be compared using equals() |
| `java:S5164` | "ThreadLocal" variables should be cleaned up when no longer used |
| `java:S5810` | Test assertions should include a message |
| `java:S5831` | Test methods should not contain too many assertions |
| `java:S5833` | Test assertion on type should be replaced with "assertInstanceOf" |
| `java:S5850` | Regular expressions should be syntactically valid |
| `java:S5855` | Regular expressions should not contain empty groups |
| `java:S5863` | Assertions should not compare an object to itself |
| `java:S5866` | Regex flags should be extracted from the regex when "Pattern.compile" is used |
| `java:S5868` | Unicode-aware versions of character classes should be preferred |
| `java:S5917` | "DateTimeFormatter" should be used for date/time formatting |
| `java:S5960` | Assertions should not be used in production code |
| `java:S5967` | Test methods should not contain too many assertions |
| `java:S5998` | Regular expressions should not overflow the stack |
| `java:S6070` | "Thread.start()" should not be called in constructors |
| `java:S6103` | Test assertions should check the full stack of exceptions |
| `java:S6216` | "record" classes should use the canonical constructor |
| `java:S6218` | "equals", "hashCode" and "toString" should be overridden in records with arrays |

### Vulnerability (6 rules)

| Rule | Description |
|------|-------------|
| `java:S5679` | HTML should not contain duplicate id attributes |
| `java:S5808` | Authorizing HTTP requests based on a variable is security-sensitive |
| `java:S6301` | Mobile applications should not use weak cipher modes |
| `java:S6374` | XML parsers should not be vulnerable to XXE attacks |
| `java:S6376` | XML parsers should not be vulnerable to XXE attacks |
| `java:S6377` | XML parsers should not be vulnerable to XXE attacks |

### Security Hotspot (13 rules)

| Rule | Description |
|------|-------------|
| `java:S2077` | Formatting SQL queries is security-sensitive |
| `java:S2612` | Setting file permissions is security-sensitive |
| `java:S4434` | LDAP deserialization attacks should be prevented |
| `java:S5247` | Disabling auto-escaping in template engines is security-sensitive |
| `java:S5693` | Rejecting requests with significant content length is security-sensitive |
| `java:S5804` | Using externally controlled data in custom authentication is security-sensitive |
| `java:S6263` | Configuring Spring Security session management is security-sensitive |
| `java:S6288` | Disabling Spring Security is security-sensitive |
| `java:S6291` | Using Android external storage is security-sensitive |
| `java:S6293` | Using Android database encryption without proper key management is security-sensitive |
| `java:S6300` | Using Android biometric authentication without "CryptoObject" is security-sensitive |
| `java:S6362` | "android.permission.MANAGE_EXTERNAL_STORAGE" should not be used |
| `java:S6363` | "android.permission.QUERY_ALL_PACKAGES" should not be used |

### Code Smell (113 rules)

| Rule | Description |
|------|-------------|
| `java:S106` | Standard outputs should not be used directly to log anything |
| `java:S1065` | Unused labels should be removed |
| `java:S1066` | Collapsible "if" statements should be merged |
| `java:S1068` | Unused "private" fields should be removed |
| `java:S107` | Methods should not have too many parameters |
| `java:S108` | Nested blocks of code should not be left empty |
| `java:S110` | Inheritance tree of classes should not be too deep |
| `java:S1110` | Redundant pairs of parentheses should be removed |
| `java:S1117` | Local variables should not shadow class fields |
| `java:S1119` | Labels should not be used |
| `java:S112` | Generic exceptions should never be thrown |
| `java:S1121` | Assignments should not be made from within sub-expressions |
| `java:S1123` | "@Deprecated" annotations should include an explanation |
| `java:S1130` | "throws" declarations should not be superfluous |
| `java:S1134` | Track uses of "FIXME" tags |
| `java:S1141` | Try-catch blocks should not be nested |
| `java:S1144` | Unused "private" methods should be removed |
| `java:S1149` | Synchronized classes Vector, Hashtable, Stack and StringBuffer should not be used |
| `java:S1150` | Enumeration should not be implemented |
| `java:S1161` | "@Override" annotation should be used on any method overriding another |
| `java:S1168` | Empty arrays and collections should be returned instead of null |
| `java:S1171` | Non-static initializer blocks should not be used |
| `java:S1172` | Unused method parameters should be removed |
| `java:S1176` | Public types, methods and fields should be documented with Javadoc |
| `java:S1181` | Throwable and Error should not be caught |
| `java:S1191` | Classes from "sun.*" or "com.sun.*" packages should not be used |
| `java:S1193` | Exception types should not be tested using "instanceof" in catch blocks |
| `java:S1223` | Non-constructor methods should not have the same name as the enclosing class |
| `java:S125` | Sections of code should not be commented out |
| `java:S127` | "for" loop stop conditions should be invariant |
| `java:S1448` | Classes should not have too many methods |
| `java:S1479` | "switch" statements should not have too many "case" clauses |
| `java:S1604` | Anonymous inner classes containing only one method should become lambdas |
| `java:S1607` | Tests should not be ignored |
| `java:S1700` | A field should not duplicate the name of its containing class |
| `java:S1844` | "Object.wait(...)" should never be called on objects that implement "java.util.concurrent.locks.Condition" |
| `java:S1854` | Unused assignments should be removed |
| `java:S1871` | Two branches in a conditional structure should not have exactly the same implementation |
| `java:S2112` | "URL.hashCode" and "URL.equals" should be avoided |
| `java:S2129` | Constructors should not be used to instantiate "String", "BigInteger", "BigDecimal" and primitive-wrapper classes |
| `java:S2133` | Objects should not be created only to invoke "getClass()" |
| `java:S2139` | Exceptions should be either logged or rethrown but not both |
| `java:S2166` | Classes named like "Exception" should extend "Exception" or a subclass |
| `java:S2185` | Silly math should not be performed |
| `java:S2209` | "static" members should be accessed statically |
| `java:S2232` | "ResultSet.isLast()" should not be used |
| `java:S2234` | Arguments should be passed in the correct order |
| `java:S2326` | Unused type parameters should be removed |
| `java:S2388` | Inner class calls to super class methods should be unambiguous |
| `java:S2438` | Threads should not be used where "Runnables" are expected |
| `java:S2440` | Classes with only "static" methods should not be instantiated |
| `java:S2442` | "Lock" objects should not be "synchronized" |
| `java:S2589` | Boolean expressions should not be gratuitous |
| `java:S2629` | "Preconditions" and logging arguments should not require evaluation |
| `java:S2675` | "readObject" should not be "synchronized" |
| `java:S2681` | Multiline blocks should be enclosed in curly braces |
| `java:S2718` | "DateUtils.truncate" from Apache Commons Lang 3 should not be used |
| `java:S2925` | "Thread.sleep" should not be used in tests |
| `java:S3010` | Static fields should not be updated in constructors |
| `java:S3042` | Strings should not be concatenated using '+' in a loop |
| `java:S3358` | Ternary operators should not be nested |
| `java:S3415` | Assertion arguments should be passed in the correct order |
| `java:S3457` | Printf-style format strings should be used correctly |
| `java:S3631` | "String.valueOf()" should not be appended to a String |
| `java:S3740` | Raw types should not be used |
| `java:S3751` | "@RequestMapping" methods should be "public" |
| `java:S3824` | "Map.get" and value test should be replaced with single method call |
| `java:S3864` | "Stream.peek" should be used with caution |
| `java:S3985` | Unused "private" classes should be removed |
| `java:S4042` | "File.createTempFile" should not be used to create a directory |
| `java:S4144` | Methods should not have identical implementations |
| `java:S4165` | Assignments should not be redundant |
| `java:S4274` | Assert expressions should be complete |
| `java:S4425` | Integer.toHexString should not be used to build hexadecimal strings |
| `java:S4449` | "@Nullable" annotated values should be handled |
| `java:S4738` | Java features should be preferred to Guava |
| `java:S4925` | "cast" and "class" should not be used with "Guava" |
| `java:S5261` | "StringBuilder" should be used instead of "StringBuffer" |
| `java:S5329` | "System.out" and "System.err" should not be used as loggers |
| `java:S5413` | Mutable collection types should not be used in API signatures |
| `java:S5664` | "Optional" should only be used for return types |
| `java:S5669` | Constructor injection should be used instead of field injection |
| `java:S5738` | Members marked with "@VisibleForTesting" should not be accessed from production code |
| `java:S5776` | Exception tests should use AssertJ assertions |
| `java:S5778` | Only one method invocation is expected when testing runtime exceptions |
| `java:S5785` | JUnit AssertEquals should have only 2 or 3 parameters |
| `java:S5843` | Regular expressions should not be too complicated |
| `java:S5854` | "getClass" should not be used for tests |
| `java:S5860` | Assertions should not be mixed with production code |
| `java:S5869` | Redundant regex alternations should be removed |
| `java:S5958` | Test methods should not be too long |
| `java:S5961` | Test methods should not contain too many assertions |
| `java:S5973` | High cohesion should be maintained in test classes |
| `java:S5976` | Similar tests should be grouped in a single Parameterized test |
| `java:S5993` | "@SpringBootApplication" and "@ComponentScan" should not be used in the default package |
| `java:S6019` | Consumed Stream pipelines should not be reused |
| `java:S6035` | "Collectors.toList()" should be replaced with "Stream.toList()" |
| `java:S6126` | String concatenation should be replaced with Text Blocks |
| `java:S6202` | "instanceof" checks should be replaced with pattern matching |
| `java:S6204` | "Stream.collect()" calls should be replaced with "Stream.toList()" |
| `java:S6206` | Records should be used instead of simple data classes |
| `java:S6207` | Redundant close calls should be removed |
| `java:S6213` | Restricted identifiers should not be used as identifiers |
| `java:S6241` | "@ConfigurationProperties" classes should not be final |
| `java:S6242` | "@Value" should not be used on constructor parameters for "@ConfigurationProperties" classes |
| `java:S6243` | "@Configuration" classes should not be final |
| `java:S6326` | Regular expressions should not contain empty groups |
| `java:S6331` | Regular expressions should not be too complicated |
| `java:S6355` | Text Blocks should be used |
| `java:S6395` | Lambda expressions should not be too complex |
| `java:S6396` | Methods returning collections should not return null |
| `java:S6397` | Parameterized types should use the diamond operator |
| `etendo-software:UseADMessageForExceptions` `[Etendo]` | Use AD_Message for exception messages |

## MINOR (133 rules)

Minor rules cover style, conventions, and small improvements. Address these when
touching the affected code, but they should not block a merge.

### Bug (20 rules)

- `java:S1206` -- "equals(Object obj)" and "hashCode()" should be overridden in pairs
- `java:S1226` -- Method parameters, caught exceptions and foreach variables should not be reassigned
- `java:S2055` -- Non-serializable classes should not be written
- `java:S2066` -- "Serializable" inner classes of non-serializable outer classes should be "static"
- `java:S2097` -- "equals(Object obj)" should test argument type
- `java:S2153` -- Boxing and unboxing should not be immediately reversed
- `java:S2167` -- "compareTo" should not return "Integer.MIN_VALUE"
- `java:S2183` -- Ints and longs should not be shifted by zero or more than their number of bits-1
- `java:S2184` -- Math operands should be cast before assignment
- `java:S2200` -- "compareTo" results should not be checked for specific values
- `java:S2272` -- "Iterator.next()" methods should throw "NoSuchElementException"
- `java:S2637` -- "@NonNull" values should not be set to null
- `java:S2674` -- The value returned from a stream read should be checked
- `java:S2676` -- Neither "Math.abs" nor negation should be used on numbers that could be "MIN_VALUE"
- `java:S3020` -- Value-based classes should not be used for locking
- `java:S3077` -- Non-primitive fields should not be "volatile"
- `java:S3599` -- Double Brace Initialization should not be used
- `java:S5841` -- Assertions should not compare an object to itself
- `java:S5842` -- Assertions comparing an object to itself should be simplified
- `java:S899` -- Return values from functions without side effects should not be ignored

### Vulnerability (2 rules)

- `java:S1989` -- Exceptions should not be thrown from servlet methods
- `java:S5301` -- "%0D" and "%0A" should be sanitized from headers

### Security Hotspot (8 rules)

- `java:S1313` -- IP addresses should not be hardcoded
- `java:S2092` -- Creating cookies without the "secure" flag is security-sensitive
- `java:S3330` -- Creating cookies without the "HttpOnly" flag is security-sensitive
- `java:S3752` -- "@RequestMapping" methods should specify HTTP method
- `java:S4036` -- Setting command path is security-sensitive
- `java:S4507` -- Delivering code in production with debug features activated is security-sensitive
- `java:S5122` -- Having a permissive Cross-Origin Resource Sharing policy is security-sensitive
- `java:S5689` -- Disclosing fingerprints from web application technologies is security-sensitive

### Code Smell (103 rules)

- `java:S100` -- Method names should comply with a naming convention
- `java:S101` -- Class names should comply with a naming convention
- `java:S1075` -- URIs should not be hardcoded
- `java:S1104` -- Class variable fields should not have public accessibility
- `java:S1116` -- Empty statements should be removed
- `java:S1118` -- Utility classes should not have public constructors
- `java:S1124` -- Modifiers should be declared in the correct order
- `java:S1125` -- Boolean literals should not be redundant
- `java:S1126` -- Return of boolean expressions should not be wrapped into an "if-then-else" statement
- `java:S1128` -- Unnecessary imports should be removed
- `java:S114` -- Interface names should comply with a naming convention
- `java:S1153` -- String.valueOf() should not be appended to a String
- `java:S1155` -- Collection.isEmpty() should be used to test for emptiness
- `java:S1157` -- Case insensitive string comparisons should be made without intermediate upper/lower casing
- `java:S1158` -- Primitive wrappers should not be instantiated only for "toString" or "compareTo" calls
- `java:S116` -- Field names should comply with a naming convention
- `java:S1165` -- Exception classes should be immutable
- `java:S117` -- Local variable and method parameter names should comply with a naming convention
- `java:S1170` -- Public constants and fields initialized at declaration should be "static final"
- `java:S1182` -- Classes that override "clone" should be "Cloneable" and call "super.clone()"
- `java:S1185` -- Overriding methods should do more than simply call the same method on the super class
- `java:S119` -- Type parameter names should comply with a naming convention
- `java:S1195` -- Array designators "[]" should be on the type, not the variable
- `java:S1197` -- Array designators "[]" should be located after the type in method signatures
- `java:S1199` -- Nested code blocks should not be used
- `java:S120` -- Package names should comply with a naming convention
- `java:S1210` -- "equals(Object obj)" should be overridden along with the "compareTo(T obj)" method
- `java:S1220` -- The default unnamed package should not be used
- `java:S1264` -- A "while" loop should be used instead of a "for" loop with only condition
- `java:S1301` -- "switch" statements should have at least 3 "case" clauses
- `java:S1319` -- Declarations should use Java collection interfaces such as "List" rather than specific implementation classes
- `java:S135` -- Loops should not contain more than a single "break" or "continue" statement
- `java:S1444` -- "public static" fields should be constant
- `java:S1450` -- Private fields only used as local variables in methods should become local variables
- `java:S1481` -- Unused local variables should be removed
- `java:S1488` -- Local variables should not be declared and then immediately returned or thrown
- `java:S1596` -- "Collections.EMPTY_LIST", "EMPTY_MAP", and "EMPTY_SET" should not be used
- `java:S1602` -- Lambdas containing only one statement should not nest this statement in a block
- `java:S1610` -- Abstract classes without fields should be converted to interfaces
- `java:S1611` -- Parentheses should be removed from a single lambda input parameter when its type is inferred
- `java:S1612` -- Replaceable anonymous inner classes should use method references
- `java:S1640` -- Maps with keys that are enum values should be replaced with EnumMap
- `java:S1643` -- Strings should not be concatenated using '+' in a loop
- `java:S1659` -- Multiple variables should not be declared on the same line
- `java:S1710` -- Annotation repetitions should not be wrapped
- `java:S1858` -- "toString()" should never be called on a String object
- `java:S1874` -- "@Deprecated" code should not be used
- `java:S1905` -- Redundant casts should not be used
- `java:S1940` -- Boolean checks should not be inverted
- `java:S2065` -- Fields in non-serializable classes should not be "transient"
- `java:S2094` -- Classes should not be empty
- `java:S2130` -- Parsing should be used to convert "Strings" to primitives
- `java:S2140` -- "Math.abs" and negation should not be used on numbers that could be "MIN_VALUE"
- `java:S2147` -- Catches should be combined
- `java:S2160` -- Subclasses that add fields should override "equals"
- `java:S2165` -- "Serializable" inner classes of "Serializable" classes should be static
- `java:S2293` -- The diamond operator ("<>") should be used
- `java:S2386` -- Mutable fields should not be "public static"
- `java:S2737` -- "catch" clauses should do more than rethrow
- `java:S2786` -- Nested "enum"s should not be declared static
- `java:S2864` -- "entrySet()" should be iterated when both the key and value are needed
- `java:S2924` -- JUnit rules should be used
- `java:S3008` -- Static non-final field names should comply with a naming convention
- `java:S3012` -- Arrays should not be created for varargs parameters
- `java:S3038` -- New methods should not be named "hashCode" or "equals"
- `java:S3066` -- "enum" fields should not be publicly mutable
- `java:S3398` -- "private" methods called only by inner classes should be moved to those classes
- `java:S3400` -- Methods should not return constants
- `java:S3416` -- Loggers should be named for their enclosing classes
- `java:S3577` -- Test classes should comply with a naming convention
- `java:S3626` -- Jump statements should not be redundant
- `java:S3878` -- Arrays should not be created for varargs parameters
- `java:S4032` -- Packages containing only "package-info.java" should be removed
- `java:S4034` -- "Comparable.compareTo" should return int
- `java:S4065` -- "ThreadLocal" variables should be cleaned up when no longer used
- `java:S4087` -- "close" method invocations should not be redundant
- `java:S4201` -- Null checks should not be redundant
- `java:S4276` -- Functional interfaces should be as specialized as possible
- `java:S4349` -- "Comparator.reversed()" should not wrap a lambda
- `java:S4488` -- Composed "@RequestMapping" variants should be preferred
- `java:S4682` -- "Throwable.printStackTrace(...)" should not be called
- `java:S4719` -- "Charset.forName()" calls should be replaced with Charset constants
- `java:S4838` -- An "Iterator" with "hasNext" defined as "true" should have "next" defined
- `java:S4929` -- "readResolve" should return "Object"
- `java:S4968` -- Raw types should not be used
- `java:S4977` -- "@Deprecated" annotations should include an explanation
- `java:S5411` -- Boxed booleans should be avoided in boolean expressions
- `java:S5663` -- "static" members should be accessed statically
- `java:S5665` -- "ThreadLocal" initial values should be set with "withInitial"
- `java:S5777` -- Test assertions should check the actual values
- `java:S5838` -- AssertJ assertions should be simplified
- `java:S5853` -- Unnecessary assertion methods should not be used
- `java:S5857` -- Regular expressions should be syntactically valid
- `java:S6068` -- "System.lineSeparator()" should be used
- `java:S6201` -- "Pattern.compile()" should be used for repeated patterns
- `java:S6203` -- Array declarations should follow Java convention
- `java:S6205` -- "switch" expressions should be preferred
- `java:S6217` -- Sealed classes should not be defined in unnamed packages
- `java:S6219` -- "Sealed" interfaces should not be declared redundant
- `java:S6244` -- Unnecessary primitive boxing should be removed
- `java:S6246` -- Unnecessary String.valueOf calls should be removed
- `java:S6262` -- "@Bean" methods should be in "@Configuration" classes
- `java:S6353` -- Regular expressions should be syntactically valid

## INFO (4 rules)

Informational rules track items that may need attention but are not violations per se.

### Code Smell (4 rules)

- `java:S1133` -- Deprecated code should be removed
- `java:S1135` -- Track uses of "TODO" tags
- `java:S5786` -- JUnit5 test classes and methods should have default package visibility
- `java:S6208` -- "@Inject" should be preferred over "@Autowired"

---

## Quick Reference: Etendo-Specific Rules

These 8 rules are custom to the Etendo quality profile and address patterns specific to
the Etendo ERP framework (DAL, OBContext, admin mode). They should be memorized by all
Etendo Java developers.

| Rule | Severity | Type | Description |
|------|----------|------|-------------|
| `NoCriteriaListForUniqueRule` | CRITICAL | Code Smell | Do not call list() on OBCriteria when a unique result is expected |
| `NoGlobalOBContextVariables` | CRITICAL | Bug | Do not use global OBContext variables |
| `NoListMethodsInLoopClause` | CRITICAL | Code Smell | Do not call list methods in loop conditions |
| `RestorePreviousModeInFinally` | CRITICAL | Bug | Restore previous admin/cross-org mode in finally block |
| `SetAdminModeInTry` | CRITICAL | Bug | Set admin mode inside try block |
| `UseStringBuilderInsteadOfConcat` | CRITICAL | Code Smell | Use StringBuilder instead of string concatenation |
| `UseStringUtilsWhenPossible` | CRITICAL | Code Smell | Use StringUtils methods when possible |
| `UseADMessageForExceptions` | MAJOR | Code Smell | Use AD_Message for exception messages |

### Etendo Admin Mode Pattern (Correct)

```java
// S:SetAdminModeInTry + S:RestorePreviousModeInFinally
try {
    OBContext.setAdminMode(true);
    // ... your DAL operations ...
} finally {
    OBContext.restorePreviousMode();
}
```

### Etendo OBCriteria Unique Result Pattern (Correct)

```java
// S:NoCriteriaListForUniqueRule
OBCriteria<Product> criteria = OBDal.getInstance().createCriteria(Product.class);
criteria.add(Restrictions.eq(Product.PROPERTY_SEARCHKEY, searchKey));
criteria.setMaxResults(1);
Product product = (Product) criteria.uniqueResult(); // not list().get(0)
```

### Etendo Loop Query Pattern (Correct)

```java
// S:NoListMethodsInLoopClause
List<BaseOBObject> results = criteria.list(); // query ONCE before loop
for (int i = 0; i < results.size(); i++) {
    // ... process results.get(i) ...
}
```

---

## How to Look Up a Rule

For any `java:SNNNN` rule, the full documentation is available at:

```
https://rules.sonarsource.com/java/RSPEC-NNNN/
```

For example, `java:S2095` -> `https://rules.sonarsource.com/java/RSPEC-2095/`

For Etendo-specific rules (`etendo-software:*`), refer to the Etendo development
documentation or the SonarQube server's rule detail page.
