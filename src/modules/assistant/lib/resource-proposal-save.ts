/** Resources without server deduplication cannot be blindly retried after a lost response. */
export function createAssistantResourceSaver<T>(options: { isCurrent: () => boolean; insert: (input: T) => Promise<void> }) {
  let flight: Promise<void> | null = null, confirmed: T | null = null, uncertain = false;
  async function save(input: T) {
    if (!options.isCurrent()) throw new Error("Espera la lectura del espacio actual antes de guardar.");
    if (uncertain) throw new Error("El resultado anterior no está confirmado. Comprueba el módulo antes de crear otro registro.");
    if (confirmed) return;
    if (flight) return flight;
    flight = Promise.resolve().then(async () => {
      let sent = false;
      try {
        if (!options.isCurrent()) throw new Error("El contexto cambió antes de enviar el registro.");
        sent = true;
        await options.insert(input);
        confirmed = input;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
        if (sent && !/^(22|23|42)[A-Z0-9]{3}$/.test(code)) uncertain = true;
        throw error;
      } finally { flight = null; }
    });
    return flight;
  }
  return { save, confirmed: () => confirmed, uncertain: () => uncertain };
}
