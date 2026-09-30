import assert from "node:assert/strict";
import { buildMovementDescription } from "../src/modules/movements/lib/movement-description.ts";

assert.equal(buildMovementDescription({ description: "  Taxi  ", movementType: "expense", accountName: "Cuenta Principal" }), "Taxi");
assert.equal(buildMovementDescription({ description: "", movementType: "expense", categoryName: "Transporte", counterpartyName: "Lucía", accountName: "Cuenta Principal" }), "Transporte · Lucía · Cuenta Principal");
assert.equal(buildMovementDescription({ description: "", movementType: "income", accountName: "Cuenta Sueldo" }), "Cuenta Sueldo");
assert.equal(buildMovementDescription({ description: "", movementType: "transfer", accountName: "Cuenta Principal" }), "Cuenta Principal");
assert.equal(buildMovementDescription({ description: " ", movementType: "expense" }), "Gasto");
assert.equal(buildMovementDescription({ description: "", movementType: "obligation_payment" }), "Pago de obligación");
console.log("movement-save-parity: OK");
