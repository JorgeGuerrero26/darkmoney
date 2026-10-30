import assert from 'node:assert/strict';
import { appendToast, visibleStack } from '../src/components/ui/toast-stack.ts';

const item = (id, tone = 'success', extra = {}) => ({ id, tone, title: 'Guardado', description: 'Gasto guardado', isLeaving: false, ...extra });
let stack = appendToast([], item('1'));
stack = appendToast(stack, item('2'));
assert.equal(stack.length, 1);
assert.equal(stack[0].count, 2);
stack = appendToast(stack, item('3', 'undo', { action: () => {} }));
stack = appendToast(stack, item('4', 'error'));
assert.deepEqual(visibleStack(stack).map((entry) => entry.id), ['4', '3']);
assert.equal(stack[0].count, 2, 'un mensaje en espera se conserva');
stack = stack.filter((entry) => entry.id !== '4');
assert.deepEqual(visibleStack(stack).map((entry) => entry.id), ['3', '2']);
assert.equal(appendToast([item('a', 'undo')], item('b', 'undo')).length, 2, 'no agrupar operaciones deshacibles');
assert.equal(appendToast([item('a', 'success', { action: () => {} })], item('b')).length, 2, 'no perder acciones');
console.log('toast-stack: OK');
