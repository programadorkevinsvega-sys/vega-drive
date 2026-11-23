import { Button } from "../ui/Button";

interface FavoritesHeadingProps {
  loading: boolean;
  onRefresh: () => void;
}

export function FavoritesHeading({
  loading,
  onRefresh,
}: FavoritesHeadingProps) {
  return (
    <header className="vd-catalog__heading">
      <div className="vd-catalog__heading-copy">
        <h1 className="vd-page__title">Favoritos</h1>
        <p className="vd-catalog__description">
          Tus archivos favoritos, guardados de forma privada en tu cuenta.
        </p>
      </div>
      <Button variant="secondary" onClick={onRefresh} disabled={loading}>
        Actualizar
      </Button>
    </header>
  );
}
