import assert from "node:assert/strict";
import { buildMovementDescription } from "../src/modules/movements/lib/movement-description.ts";
import { movementSpendTypeId, movementSpendTypeLabel } from "../src/modules/movements/lib/movement-spend-type.ts";

assert.equal(buildMovementDescription({ description: "  Taxi  ", movementType: "expense", accountName: "Cuenta Principal" }), "Taxi");
assert.equal(buildMovementDescription({ description: "", movementType: "expense", categoryName: "Transporte", counterpartyName: "Lucía", accountName: "Cuenta Principal" }), "Transporte · Lucía · Cuenta Principal");
assert.equal(buildMovementDescription({ description: "", movementType: "income", accountName: "Cuenta Sueldo" }), "Cuenta Sueldo");
assert.equal(buildMovementDescription({ description: "", movementType: "transfer", accountName: "Cuenta Principal" }), "Cuenta Principal");
assert.equal(buildMovementDescription({ description: " ", movementType: "expense" }), "Gasto");
assert.equal(buildMovementDescription({ description: "", movementType: "obligation_payment" }), "Pago de obligación");
const types = [{ id: 1, name: "Necesidad" }, { id: 2, name: "Deseo" }];
assert.equal(movementSpendTypeId("expense", 2), 2);
assert.equal(movementSpendTypeId("expense", null), null);
assert.equal(movementSpendTypeId("income", 2), null);
assert.equal(movementSpendTypeId("transfer", 1), null);
assert.equal(movementSpendTypeLabel(types, null, 1), "Necesidad · De categoría");
assert.equal(movementSpendTypeLabel(types, 2, 1), "Deseo");
assert.equal(movementSpendTypeLabel(types, null, null), "Sin tipo");
console.log("movement-save-parity: OK");
