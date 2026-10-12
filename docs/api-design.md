# API Design — Project Nebula

## Experiences API

### GET /api/experiences

**Description:** Retrieve a list of available experiences.

**Method:** GET

**Query parameters:**

- `page` (optional): page number, default 1
- `limit` (optional): number of results per page, default 10
- `category` (optional): filter experiences by category

**Success response:** 200 OK

```json
{
    "data": [
        {
            "id": 1,
            "name": "Terme Pelate",
            "description": "A relaxing spa experience.",
            "price": 85,
            "category": "wellness",
            "duration_minutes": 90,
            "is_active": true
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
    }
}
```

### GET /api/experiences/:id

**Description:** Retrieve a specific experience by its ID.

**Path parameters:**

- `id` (required): positive integer identifying the experience.

**Success response:** 200 OK

```json
{
    "id": 2,
    "name": "Moonwalk dei Puzzini",
    "description": "Explore the lunar landscape with our sphynx astronauts.",
    "price_cents": 12000,
    "currency": "EUR",
    "category": "adventure",
    "duration_minutes": 120,
    "is_active": true
}
```

**Error responses:**

- `400 Bad Request`: invalid ID format.
- `404 Not Found`: experience not found.
- `500 Internal Server Error`: unexpected server error.
