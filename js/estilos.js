const getBadgeClass = (estado) => {
  switch ((estado ?? '').toString().trim().toLowerCase()) {
    case 'indeciso':
      return 'text-bg-warning bg-opacity-10 text-warning border border-warning-subtle';
    case 'impulsivo':
      return 'text-bg-danger bg-opacity-10 text-danger border border-danger-subtle';
    case 'informado':
      return 'text-bg-primary bg-opacity-10 text-primary border border-primary-subtle';
    case 'discutidor':
      return 'text-bg-dark bg-opacity-10 text-dark border border-dark-subtle';
    case 'silencioso':
      return 'text-bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle';
    case 'Negociador':
      return 'text-bg-success bg-opacity-10 text-success border border-success-subtle';
    case 'no contesta':
      return 'text-bg-info bg-opacity-10 text-info border border-info-subtle';
    default:
      return 'text-bg-light border';
  }
};