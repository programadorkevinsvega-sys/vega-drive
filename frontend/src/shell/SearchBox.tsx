import { useEffect, useState } from "react";
import { MAX_QUERY_LENGTH, type Route } from "../router/routes";
import { navigate } from "../router/use-route";
import { Icon } from "../ui/Icon";

/** Lleva a la ruta de busqueda; la busqueda local llegara en la Entrega 5. */
export function SearchBox({ route }: { route: Route }) {
  const routeQuery = route.name === "search" ? route.query : "";
  const [value, setValue] = useState(routeQuery);

  useEffect(() => setValue(routeQuery), [routeQuery]);

  return (
    <form
      className="vd-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        navigate({ name: "search", query: value.trim() });
      }}
    >
      <Icon name="search" size="sm" />
      <input
        type="search"
        className="vd-search__input"
        placeholder="Buscar en tu unidad"
        aria-label="Buscar en Vega Drive"
        maxLength={MAX_QUERY_LENGTH}
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  );
}
