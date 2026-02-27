---
description: "/etendo:report — Create, edit, or register a Jasper Report in an Etendo module"
argument-hint: "<description, e.g. 'sales order report with customer and totals'>"
---

# /etendo:report — Create, edit, or register a Jasper Report

**Arguments:** `$ARGUMENTS` (e.g., "create sales order report", "register existing report", "edit report at path/to/file.jrxml")

---

First, read `skills/etendo-_context/SKILL.md` and `skills/etendo-_webhooks/SKILL.md`.

A **Jasper Report** in Etendo is a JRXML file (JasperReports 6.0.0) that produces PDF/HTML output. Reports can be launched from a menu entry or from a button in a window.

## Step 1: Determine operation

- `create` → create a new JRXML report file
- `edit {path}` → modify an existing JRXML file
- `register` → register a report in the Application Dictionary
- Natural language → infer intent. If unclear, ask: "Do you want to create, edit, or register a report?"

## Step 2: Gather information

**For create:**
- Report name (required)
- Module javapackage (from context)
- Storage path: `modules/{javapackage}/src/{java/package/path}/reports/{ReportName}.jrxml`
- What data should the report show? (tables, columns, filters)
- Parameters (e.g., `DOCUMENT_ID`, date ranges)
- Page layout: portrait (default) or landscape
- Grouping requirements (e.g., group by order, by customer)

**For register:**
- Path to the JRXML file
- Process name and search key
- Which window/tab should launch it (optional)

## Step 3: Verify database fields

Before creating or modifying a report, verify that all referenced columns exist in the database:

```sql
-- Check columns of a table:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = '{table_name}'
ORDER BY ordinal_position;
```

Or via headless:
```bash
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/ViewColumn?table=${TABLE_ID}&_endRow=200"
```

If fields don't exist or are incorrect, ask the user to correct them before proceeding.

## Step 4: Create the JRXML file

**JRXML structure rules:**
- Use JasperReports 6.0.0 schema
- `<textElement>` must NEVER be placed directly under `<band>` — always inside `<textField>` or `<staticText>`
- `<band>` only contains: `<textField>`, `<staticText>`, `<line>`, `<rectangle>`, `<image>`, `<subreport>`, etc.
- Encoding: always `UTF-8`
- Default font: `Bitstream Vera Sans`, size 10
- All comments in English

**Template:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jasperReport xmlns="http://jasperreports.sourceforge.net/jasperreports"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://jasperreports.sourceforge.net/jasperreports http://jasperreports.sourceforge.net/xsd/jasperreport.xsd"
  name="{ReportName}" pageWidth="595" pageHeight="842"
  columnWidth="483" leftMargin="56" rightMargin="56" topMargin="56" bottomMargin="56">

  <property name="ireport.encoding" value="UTF-8"/>
  <style name="default" vAlign="Middle" fontName="Bitstream Vera Sans" fontSize="10"/>
  <style name="Report_Title" fontSize="18"/>
  <style name="Group_Data_Label" fontSize="11" isBold="true"/>

  <!-- Parameters -->
  <parameter name="REPORT_TITLE" class="java.lang.String"/>
  <parameter name="DOCUMENT_ID" class="java.lang.String"/>

  <!-- Query -->
  <queryString>
    <![CDATA[
    SELECT t.column1, t.column2, bp.name AS partner_name
    FROM {table} t
    JOIN c_bpartner bp ON t.c_bpartner_id = bp.c_bpartner_id
    WHERE t.{table}_id = $P{DOCUMENT_ID}
    ]]>
  </queryString>

  <!-- Fields (must match query columns) -->
  <field name="column1" class="java.lang.String"/>
  <field name="column2" class="java.util.Date"/>
  <field name="partner_name" class="java.lang.String"/>

  <!-- Title -->
  <title>
    <band height="30">
      <textField>
        <reportElement style="Report_Title" x="0" y="0" width="483" height="30"/>
        <textFieldExpression><![CDATA[$P{REPORT_TITLE}]]></textFieldExpression>
      </textField>
    </band>
  </title>

  <!-- Column headers -->
  <columnHeader>
    <band height="20">
      <staticText>
        <reportElement style="Group_Data_Label" x="0" y="0" width="200" height="20"/>
        <text><![CDATA[Column 1]]></text>
      </staticText>
      <staticText>
        <reportElement style="Group_Data_Label" x="200" y="0" width="150" height="20"/>
        <text><![CDATA[Column 2]]></text>
      </staticText>
    </band>
  </columnHeader>

  <!-- Detail rows -->
  <detail>
    <band height="20">
      <textField>
        <reportElement x="0" y="0" width="200" height="20"/>
        <textFieldExpression><![CDATA[$F{column1}]]></textFieldExpression>
      </textField>
      <textField>
        <reportElement x="200" y="0" width="150" height="20"/>
        <textFieldExpression><![CDATA[$F{column2}]]></textFieldExpression>
      </textField>
    </band>
  </detail>

  <!-- Page footer -->
  <pageFooter>
    <band height="20">
      <textField>
        <reportElement x="400" y="0" width="83" height="20"/>
        <textFieldExpression><![CDATA["Page " + $V{PAGE_NUMBER}]]></textFieldExpression>
      </textField>
    </band>
  </pageFooter>
</jasperReport>
```

**For landscape reports:** set `pageWidth="842"` `pageHeight="595"` `columnWidth="730"`.

## Step 5: Register the report in AD

Use the `ProcessDefinitionJasper` webhook to register the report and optionally attach it to a window:

```bash
ETENDO_URL=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('etendoUrl','http://localhost:8080/etendo'))")
API_KEY=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('apikey',''))")

curl -s -X POST "${ETENDO_URL}/webhooks/?name=ProcessDefinitionJasper&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Javapackage": "{javapackage}",
    "Name": "{Report Visible Name}",
    "SearchKey": "{PREFIX_ReportName}",
    "Description": "{description}",
    "ReportFilename": "{ReportName}.jrxml"
  }'
```

## Step 6: Compile and deploy

```bash
JAVA_HOME=... ./gradlew smartbuild > /tmp/smartbuild.log 2>&1
tail -20 /tmp/smartbuild.log
```

## Step 7: Result

```
+ Report "{name}" created

  File: modules/{javapackage}/src/{path}/reports/{ReportName}.jrxml
  Registered: {Yes/No}

  Next steps:
    /etendo:smartbuild -> compile and deploy
    Then: UI -> refresh -> {name} in the menu or Process Request window
```
