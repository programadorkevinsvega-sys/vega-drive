interface CatalogFavoriteErrorProps {
  message: string;
}

export function CatalogFavoriteError({ message }: CatalogFavoriteErrorProps) {
  if (!message) return null;
  return (
    <div className="vd-catalog__error" role="alert">
      {message}
    </div>
  );
}
