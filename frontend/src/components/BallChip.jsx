export default function BallChip({ symbol, title }) {
  let kind = 'dot';
  if (symbol.startsWith('W') && !symbol.startsWith('Wd')) kind = 'wicket';
  else if (symbol === '4') kind = 'four';
  else if (symbol === '6') kind = 'six';
  else if (symbol.startsWith('Wd') || symbol.startsWith('Nb') || symbol.endsWith('b')) kind = 'extra';
  else if (symbol !== '•') kind = 'run';
  return <span className={`ball ball-${kind}`} title={title}>{symbol}</span>;
}
