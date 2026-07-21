import { formatAddressLines } from "../api/geocode";

export default function PlaceDetailsCard({
  place,
  onClose,
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
      <md-elevation aria-hidden="true" />
      <div className="place-details-header">
        <div>
          <h2 className="md-typescale-title-large">{place.name}</h2>
          {(place.type || place.category) && (
            <p className="md-typescale-label-medium place-type">
              {[place.category, place.type].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {onClose && (
          <md-icon-button type="button" aria-label="Close" onClick={onClose}>
            <md-icon>close</md-icon>
          </md-icon-button>
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
        <md-filled-button type="button" onClick={onDirectionsTo}>
          <md-icon slot="icon">directions</md-icon>
          Directions
        </md-filled-button>
        <md-outlined-button type="button" onClick={onDirectionsFrom}>
          From here
        </md-outlined-button>
      </div>
    </div>
  );
}
