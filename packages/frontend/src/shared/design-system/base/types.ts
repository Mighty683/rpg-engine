/** Options for a single-value selection control. Domain choices belong to its consumer. */
export type SelectOption<T extends string | number = string> = {
  label: string;
  value: T;
  disabled?: boolean;
};
