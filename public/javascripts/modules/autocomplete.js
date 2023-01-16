function autocomplete(input, latInput, lngInput) {
    if(!input) return // skip this fn from running if there not input on the page

    // Google Maps doesn't work - need valid key
    const dropdown = new google.maps.places.Autocomplete(input)

    dropdown.addListener('place_changed', () => {
        const place = dropdown.getPlace()
        latInput.value = place.geometry.location.lat() // 48.85661400000001
        lngInput = place.geometry.location.lng() // 2.3522219000000177
    })

    // if someone hits enter on the address field, don't submit the form
    input.on('keydown', (e) => {
        if(e.keyCode === 13) {
            e.preventDefault()
        }
    })
}

export default autocomplete