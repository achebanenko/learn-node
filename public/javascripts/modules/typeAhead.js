import axios from 'axios'
import dompurify from 'dompurify'

function searchResultsHTML(stores) {
    return stores.map((store) => {
        return `<a href="/store/${store.slug}" class="search__result"><strong>${store.name}</strong><a/>`
    }).join('')
}

function typeAhead(search) {
    if(!search) return
    
    const searchInput = search.querySelector('input[name="search"]')
    const searchResults = search.querySelector('.search__results')
    // let i

    // searchInput.addEventListener
    searchInput.on('input', function() {
        if(!this.value) {
            searchResults.style.display = 'none'
            return
        }

        searchResults.style.display = 'block'
        // i = undefined

        axios.get(`/api/search?q=${this.value}`)
        .then(res => {
            if(res.data.length) {
                const html = searchResultsHTML(res.data)
                searchResults.innerHTML = dompurify.sanitize(html)
                return
            }
            searchResults.innerHTML = dompurify.sanitize(`<div class="search__result">No results for ${this.value} found</div>`)
        })
        .catch((err) => {
            console.error(err)
        })
    })

    searchInput.on('keyup', function(e) {
        if(![38, 40, 13].includes(e.keyCode)) {
            return
        }

        const activeClass = 'search__result--active'
        const current = search.querySelector(`.${activeClass}`)
        const items = search.querySelectorAll('.search__result')
        let next

        if(e.keyCode === 40 && current) {
            next = current.nextElementSibling || items[0]
        } else if(e.keyCode === 40) {
            next = items[0]
        } else if(e.keyCode === 38 && current) {
            next = current.previousElementSibling || items[items.length - 1]
        } else if(e.keyCode === 38) {
            items[items.length - 1]
        } else if(e.keyCode === 13 && current.href) {
            window.location = current.href
            return
        }

        if(current) {
            current.classList.remove(activeClass)
        }
        next.classList.add(activeClass)

        // my variant
        // if(e.keyCode === 13 && i !== undefined) {
        //     window.location.assign(items[i].getAttribute('href'))
        // } else if(e.keyCode === 40) {
        //     if(i === undefined) i = 0
        //     else if(++i === items.length) i = 0
        // } else if(e.keyCode === 38) {
        //     if(i === undefined) i = items.length - 1
        //     else if(--i === -1) i = items.length - 1
        // }

        // items.forEach(link => {
        //     link.classList.remove(activeClass)
        // })
        // items[i].classList.add(activeClass)
    })
}

export default typeAhead