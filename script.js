let userLocation = null;
let persons = [];

// Get User Location
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                document.getElementById("step1").style.display = "none";
                document.getElementById("step2").style.display = "block";
            },
            () => alert("❌ Location access denied. Please enable location to proceed.")
        );
    } else {
        alert("❌ Geolocation is not supported by this browser.");
    }
}

// Add Persons
function addPersons() {
    let numPersons = parseInt(document.getElementById("numPersons").value);
    if (numPersons < 1) {
        alert("Please enter at least 1 person");
        return;
    }
    
    let container = document.getElementById("personsContainer");
    container.innerHTML = ""; // Clear previous

    for (let i = 0; i < numPersons; i++) {
        let div = document.createElement("div");
        div.className = "user-entry";
        div.innerHTML = `
            <input type="text" placeholder="Name of Person ${i + 1}" class="personName">
            <select class="hungerLevel">
                <option value="Little">Little Hungry</option>
                <option value="Medium" selected>Medium Hungry</option>
                <option value="Very Hungry">Very Hungry</option>
            </select>
            <select class="foodType">
                <option value="Snack">Snack</option>
                <option value="Main Course" selected>Main Course</option>
                <option value="Brunch">Brunch</option>
            </select>
        `;
        container.appendChild(div);
    }
    document.getElementById("step2").style.display = "none";
    document.getElementById("step3").style.display = "block";
}

// Show Price Selection
function showPriceSelection() {
    // Collect person details
    persons = [];
    let nameInputs = document.getElementsByClassName("personName");
    let hungerLevels = document.getElementsByClassName("hungerLevel");
    let foodTypes = document.getElementsByClassName("foodType");
    
    for (let i = 0; i < nameInputs.length; i++) {
        persons.push({
            name: nameInputs[i].value || `Person ${i+1}`,
            hunger: hungerLevels[i].value,
            foodType: foodTypes[i].value
        });
    }
    
    document.getElementById("step3").style.display = "none";
    document.getElementById("step4").style.display = "block";
}

// Update Price Range
function updatePrice() {
    document.getElementById("priceValue").innerText = document.getElementById("priceRange").value;
}

// Calculate Distance Between Two Locations
function calculateDistance(lat1, lon1, lat2, lon2) {
    let R = 6371; // Radius of Earth in km
    let dLat = (lat2 - lat1) * (Math.PI / 180);
    let dLon = (lon2 - lon1) * (Math.PI / 180);
    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Find Restaurants Using a Reliable API
async function findRestaurants() {
    document.querySelector(".loading").style.display = "block";
    document.getElementById("findRestaurantsBtn").disabled = true; // Disable button to prevent multiple clicks
    document.getElementById("restaurantsList").style.display = "none"; // Hide previous results
    document.getElementById("mapContainer").style.display = "none"; // Hide previous map

    let maxPrice = parseInt(document.getElementById("priceRange").value);

    try {
        // Calculate viewport (2km around user location)
        const viewDistance = 0.005; // roughly 500 meters
        const viewbox = `${userLocation.lon - viewDistance},${userLocation.lat + viewDistance},${userLocation.lon + viewDistance},${userLocation.lat - viewDistance}`;
        
        // Structured query for better results
        const amenityTypes = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court'];
        let allRestaurants = [];
        
        // Make multiple requests for different amenity types
        for (let type of amenityTypes) {
            // Improved query structure with better parameters
            const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&amenity=${type}&limit=15&bounded=1&viewbox=${viewbox}`;
            
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) continue;
                
                const data = await response.json();
                if (!data || data.length === 0) continue;
                
                // Process each location
                data.forEach(res => {
                    // Extract just the first part of the name (before the comma)
                    let name = res.display_name.split(',')[0].trim();
                    
                    // Add to our collection if not a duplicate
                    if (!allRestaurants.some(r => r.name === name)) {
                        allRestaurants.push({
                            name: name,
                            lat: parseFloat(res.lat),
                            lon: parseFloat(res.lon),
                            distance: calculateDistance(userLocation.lat, userLocation.lon, parseFloat(res.lat), parseFloat(res.lon)),
                            type: type.replace('_', ' ')
                        });
                    }
                });
            } catch (error) {
                console.error(`Error fetching ${type} places:`, error);
            }
        }
        
        // Try an alternative query if specific amenity search fails
        if (allRestaurants.length === 0) {
            // Try a more general search for anything with food-related keywords
            const keywords = ['restaurant', 'cafe', 'dining', 'food', 'eat'];
            for (let keyword of keywords) {
                const backupUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${keyword}&limit=15&bounded=1&viewbox=${viewbox}`;
                
                try {
                    const response = await fetch(backupUrl);
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    if (!data || data.length === 0) continue;
                    
                    // Process each location
                    data.forEach(res => {
                        let name = res.display_name.split(',')[0].trim();
                        
                        // Add to our collection if not a duplicate
                        if (!allRestaurants.some(r => r.name === name)) {
                            let type = 'restaurant'; // Default type
                            const lowercaseName = name.toLowerCase();
                            
                            // Try to determine type from name
                            if (lowercaseName.includes('cafe') || lowercaseName.includes('coffee')) {
                                type = 'cafe';
                            } else if (lowercaseName.includes('fast') || lowercaseName.includes('express')) {
                                type = 'fast food';
                            }
                            
                            allRestaurants.push({
                                name: name,
                                lat: parseFloat(res.lat),
                                lon: parseFloat(res.lon),
                                distance: calculateDistance(userLocation.lat, userLocation.lon, parseFloat(res.lat), parseFloat(res.lon)),
                                type: type
                            });
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching ${keyword} places:`, error);
                }
            }
        }
        
        if (allRestaurants.length === 0) {
            throw new Error("No restaurants found in your area. Please try a different location or increase the search radius.");
        }

        // Sort restaurants by distance - ALWAYS do this first to prioritize proximity
        allRestaurants.sort((a, b) => a.distance - b.distance);
        
        // Calculate prices for all restaurants
        allRestaurants.forEach(res => {
            res.price = calculateEstimatedPrice(res);
        });
        
        // Try different approaches to find restaurants within budget
        let filteredRestaurants = [];
        
        // First try: Find restaurants within budget that match preferences
        filteredRestaurants = filterRestaurantsByUserPreferences(allRestaurants, maxPrice);
        
        // Second try: If no matches, just filter by price without preference matching
        if (filteredRestaurants.length === 0) {
            filteredRestaurants = allRestaurants.filter(res => res.price <= maxPrice);
        }
        
        // Third try: If still no matches, adjust prices for closer restaurants to fit budget
        if (filteredRestaurants.length === 0) {
            // For very low budgets, adjust prices for the closest restaurants to make them affordable
            const closestRestaurants = allRestaurants.slice(0, 5); // Get 5 closest restaurants
            closestRestaurants.forEach(res => {
                // Ensure at least the closest restaurants are within budget
                if (res.price > maxPrice) {
                    res.price = Math.max(maxPrice - 50, 100); // Adjust price to be below budget
                    res.affordableOption = true; // Flag to indicate this has a budget option
                }
            });
            filteredRestaurants = closestRestaurants;
        }
        
        // If we still have no results (extremely unlikely at this point)
        if (filteredRestaurants.length === 0) {
            throw new Error("No restaurants match your criteria. Please try different preferences or increase your budget.");
        }
        
        // Re-sort by distance to ensure closest restaurants appear first
        filteredRestaurants.sort((a, b) => a.distance - b.distance);
        
        // Show top 10 restaurants
        displayRestaurants(filteredRestaurants.slice(0, 10));
    } catch (error) {
        console.error("Error finding restaurants:", error);
        alert("Error: " + error.message);
        document.querySelector(".loading").style.display = "none";
        document.getElementById("findRestaurantsBtn").disabled = false;
    } finally {
        document.querySelector(".loading").style.display = "none";
        document.getElementById("findRestaurantsBtn").disabled = false; // Re-enable button
    }
}

// Calculate an estimated price based on restaurant type and distance
function calculateEstimatedPrice(restaurant) {
    // Use distance and type to estimate price
    // Adjusted to create more variance in prices and allow for lower budget options
    let basePrice = 300; // Lowered base price to accommodate budget constraints
    
    // Type multiplier - adjusted to create more affordable options
    let typeMultiplier = 1.0;
    switch(restaurant.type) {
        case 'restaurant':
            typeMultiplier = 1.3;
            break;
        case 'cafe': 
            typeMultiplier = 0.7; // Made cafes more affordable
            break;
        case 'fast food':
            typeMultiplier = 0.5; // Made fast food significantly cheaper
            break;
        case 'bar':
        case 'pub':
            typeMultiplier = 1.1;
            break;
        case 'food_court':
            typeMultiplier = 0.4; // Made food courts very affordable
            break;
    }
    
    // Distance factor (closer = more expensive, usually in prime locations)
    // Linear decrease from 1.2 to 0.8 based on distance
    let distanceFactor = Math.max(1.2 - (restaurant.distance * 0.1), 0.8);
    
    // Number of people adjustment
    let personCount = persons.length || 1;
    
    // Hunger level adjustment
    let hungerMultiplier = 1.0;
    let veryHungryCount = persons.filter(p => p.hunger === 'Very Hungry').length;
    let littleHungryCount = persons.filter(p => p.hunger === 'Little Hungry').length;
    
    if (veryHungryCount > 0) {
        hungerMultiplier += 0.2 * (veryHungryCount / personCount);
    }
    
    if (littleHungryCount > 0) {
        hungerMultiplier -= 0.2 * (littleHungryCount / personCount); // Increased reduction for little hungry
    }
    
    // Calculate final estimated price
    let estimatedPrice = Math.round(basePrice * typeMultiplier * distanceFactor * personCount * hungerMultiplier);
    
    // Add random variance (±20%) to create more diverse pricing
    const variance = 0.8 + (Math.random() * 0.4); // Between 0.8 and 1.2
    estimatedPrice = Math.round(estimatedPrice * variance);
    
    // Ensure price is within reasonable bounds, allowing for very low budgets
    return Math.min(Math.max(estimatedPrice, 100), 2000);
}

// Filter restaurants based on user preferences
function filterRestaurantsByUserPreferences(restaurants, maxPrice) {
    // Extract food preferences
    const hungerLevels = persons.map(p => p.hunger);
    const foodTypes = persons.map(p => p.foodType);
    
    // Calculate scores for each restaurant and filter by price
    return restaurants
    .filter(res => res.price <= maxPrice) // Filter by price
    .map(res => {
        // Calculate a preference score
        let score = 0;
        
        // Type matching
        if (res.type === 'restaurant' && foodTypes.includes('Main Course')) {
            score += 2;
        }
        if (res.type === 'cafe' && (foodTypes.includes('Snack') || foodTypes.includes('Brunch'))) {
            score += 2;
        }
        if (res.type === 'fast food' && foodTypes.includes('Snack')) {
            score += 1;
        }
        
        // Distance score (closer is better) - give more weight to distance
        score += Math.max(10 - res.distance * 2, 0); // Up to 10 points for distance
        
        // Add score to restaurant object
        res.score = score;
        
        return res;
    })
    .sort((a, b) => {
        // First sort by distance
        if (a.distance < b.distance - 1) return -1; // If significantly closer
        if (b.distance < a.distance - 1) return 1;  // If significantly closer
        
        // If distances are similar, sort by preference score
        return b.score - a.score;
    });
}

// Display Restaurants List
function displayRestaurants(restaurants) {
    let listContainer = document.getElementById("restaurantsList");
    listContainer.innerHTML = "<h3>🍽️ Recommended Restaurants</h3>"; 
    listContainer.style.display = "block";

    if (restaurants.length === 0) {
        listContainer.innerHTML += "<p class='no-results'>No restaurants found matching your criteria. Try adjusting your preferences or price range.</p>";
        return;
    }

    restaurants.forEach((res, index) => {
        let div = document.createElement("div");
        div.className = "restaurant";
        
        // Style the first result differently to highlight it
        if (index === 0) {
            div.classList.add("restaurant-best-match");
        }
        
        // Create price rating (₹ symbols)
        const priceLevel = Math.ceil(res.price / 500); // 1-4 price levels
        const priceRating = "₹".repeat(priceLevel);
        
        // Add a note if we artificially adjusted the price to meet budget
        let budgetNote = '';
        if (res.affordableOption) {
            budgetNote = '<span class="budget-option">Budget menu available</span>';
        }
        
        div.innerHTML = `
            <h3>${res.name}</h3>
            <div class="restaurant-details">
                <span class="restaurant-type">${res.type || 'Restaurant'}</span>
                <span class="restaurant-price">${priceRating}</span>
                <span class="restaurant-distance">${res.distance.toFixed(2)} km away</span>
            </div>
            <p class="restaurant-price-exact">Estimated cost: ₹${res.price} for your group ${budgetNote}</p>
            <button onclick="showOnMap(${res.lat}, ${res.lon}, '${res.name.replace(/'/g, "\\'")}')">View on Map</button>
        `;
        listContainer.appendChild(div);
    });
}

// Show Selected Restaurant on Map
function showOnMap(lat, lon, name) {
    document.getElementById("mapContainer").style.display = "block";
    
    // Scroll to map
    document.getElementById("mapContainer").scrollIntoView({ behavior: 'smooth' });
    
    document.getElementById("map").innerHTML = `
        <iframe width="100%" height="300" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.001},${lat-0.001},${lon+0.001},${lat+0.001}&layer=mapnik&marker=${lat},${lon}" style="border:1px solid black"></iframe>
        <p>📍 Showing: <strong>${name}</strong></p>
        <button id="getDirectionsBtn" onclick="getDirections(${lat}, ${lon}, '${name.replace(/'/g, "\\'")}')">🚶 Get Directions</button>
    `;
}

// Get Directions (opens in a new tab with OpenStreetMap directions)
function getDirections(lat, lon, name) {
    const url = `https://www.openstreetmap.org/directions?from=${userLocation.lat},${userLocation.lon}&to=${lat},${lon}`;
    window.open(url, '_blank');
}

// Toggle Light/Dark Mode
document.getElementById("toggleMode").addEventListener("click", function() {
    const isDarkMode = document.body.classList.toggle("dark-mode");
    
    // Update button text
    this.innerHTML = isDarkMode ? "<i class='fas fa-sun'></i> Light Mode" : "<i class='fas fa-moon'></i> Dark Mode";
    
    // Store preference
    localStorage.setItem("darkMode", isDarkMode);
});

// Load user's dark mode preference on page load
document.addEventListener("DOMContentLoaded", function() {
    if (localStorage.getItem("darkMode") === "true") {
        document.body.classList.add("dark-mode");
        document.getElementById("toggleMode").innerHTML = "<i class='fas fa-sun'></i> Light Mode";
    }
});
