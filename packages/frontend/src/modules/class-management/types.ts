/** A free benefit being explored in the class creation prototype. */
export interface BenefitDraft {
  id: number;
  name: string;
  kind: "text" | "modifier";
  description: string;
  stat: string;
  amount: string;
}
