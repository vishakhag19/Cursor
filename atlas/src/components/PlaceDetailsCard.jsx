import { formatAddressLines } from "../api/geocode";

export default function PlaceDetailsCard({
  place,
  onDirectionsTo,
  onDirectionsFrom,
}) {
  if (!place) return null;
  const lines = formatAddressLines(place);
  const extras = place.extratags || {};
  const phone = extras.phone || extras["contact:phone"];
  const website = extras.website || extras["contact:website"];
  const hours = extras.opening_hours;
  const cuisine = extras.cuisine;

  return (
    <div className="place-card m3-card place-details">
      <div className="place-details-header">
        <h2 className="md-typescale-title-large">{place.name}</h2>
        {(place.type || place.category) && (
          <p className="md-typescale-label-medium place-type">
            {[place.category, place.type].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="place-address md-typescale-body-medium">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>

      <p className="md-typescale-body-small place-coords">
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
      </p>

      {(phone || website || hours || cuisine) && (
        <ul className="place-facts md-typescale-body-small">
          {cuisine && <li>Cuisine: {cuisine.replace(/_/g, " ")}</li>}
          {hours && <li>Hours: {hours}</li>}
          {phone && <li>Phone: {phone}</li>}
          {website && (
            <li>
              <a href={website} target="_blank" rel="noreferrer">
                Website
              </a>
            </li>
          )}
        </ul>
      )}

      <div className="place-actions">
        <md-filled-button type="button" class="place-action-pill" onClick={onDirectionsTo}>
          <md-icon slot="icon">directions</md-icon>
          Directions
        </md-filled-button>
        <md-filled-tonal-button type="button" class="place-action-pill" onClick={onDirectionsFrom}>
          <md-icon slot="icon">near_me</md-icon>
          From here
        </md-filled-tonal-button>
      </div>
    </div>
  );
}
