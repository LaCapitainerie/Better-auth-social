---
name: Option - New Option
about: Describe this issue template's purpose here.
title: Options - [Namehere]
labels: Option, Test
assignees: ''

---

### Option :
#### `[NameHere]`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: `...`

### Errors :
#### `OPTION_ERROR: Option error description.`

### Tests :

```typescript
describe("[NameHere]", () => {
   it("should return an error when the option is set to false", async () => {});

   it("should work when the option is set to true", async () => {});
});
```
