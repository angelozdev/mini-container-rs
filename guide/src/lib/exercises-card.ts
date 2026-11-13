function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function summarizeExercises(exercises: number, hints: number): string {
  return `${counted(exercises, "ejercicio", "ejercicios")} · ${counted(hints, "pista", "pistas")}`;
}
