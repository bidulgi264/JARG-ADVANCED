export const catalog = [
  { id: 1, name: "Special price", answer: "apple" },
  { id: 2, name: "Smoking gun", answer: "To be, or not to be." },
  { id: 3, name: "Time in a bottle", answer: "Time is Gold", clientCompletable: true },
  { id: 4, name: "Perfect fit", answer: "Perfect", clientCompletable: true },
  { id: 5, name: "Lucky strike", answer: "One in a million", clientCompletable: true },
  { id: 6, name: "All-seeing Eye", answer: "panopticon", clientCompletable: true },
  { id: 7, name: "Eclipse", answer: "Mnestis", clientCompletable: true },
  { id: 8, name: "babo is you", answer: "WIN", clientCompletable: true },
  { id: 9, name: "Equation", answer: "82.5" },
  { id: 10, name: "Pattern", answer: "134679" },
  { id: 11, name: "Blackout", answer: "216" },
  { id: 12, name: "Signal", answer: "break" },
  { id: 13, name: "Print", answer: "Science" },
  { id: 14, name: "Chase", answer: "Gate" },
  { id: 15, name: "Strike", answer: "click", clientCompletable: true },
  { id: 16, name: "Protect", answer: "next", clientCompletable: true },
].map((problem) => ({
  slug: `problem-${String(problem.id).padStart(2, "0")}`,
  rendererKey: `problem-${String(problem.id).padStart(2, "0")}`,
  version: 1,
  published: true,
  hint: "화면에 보이는 요소뿐 아니라 움직이거나 조작할 수 있는 요소도 살펴보세요.",
  clientCompletable: false,
  ...problem,
}));

export function normalizeAnswer(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}
