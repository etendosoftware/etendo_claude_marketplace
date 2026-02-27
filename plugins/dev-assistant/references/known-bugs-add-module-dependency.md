# Known Bug: AddModuleDependency uses incorrect setter

## Symptom
Compile error: `cannot find symbol: method setIsIncluded(boolean)`.

## Cause
The method in the generated entity is `setIncluded(Boolean)`, not `setIsIncluded`.

## Fix
Change `dep.setIsIncluded(isIncluded)` → `dep.setIncluded(isIncluded)` in `AddModuleDependency.java`.
