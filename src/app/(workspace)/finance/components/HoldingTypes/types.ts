export type SectionHandlers<Doc> = {
  data: Doc;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onChange: (section: 'localBanks' | 'remoteBanks', index: number, field: string, value: string | number) => void;
};
