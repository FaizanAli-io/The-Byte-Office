export const percentFormatter = ({
  name,
  percent
}: {
  name: string;
  percent: number;
}) => `${name} (${(percent * 100).toFixed(1)}%)`;
