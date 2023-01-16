# Learn Node
https://github.com/wesbos/Learn-Node/commits/master




## 42 Deploying to now

Copy and slightly change `variables.env` to `variables.env.now`

```
NODE_ENV=production
DATABASE=...
MAIL_USER=...
MAIL_PASS=...
MAIL_HOST=...
MAIL_PORT=...
PORT=80
MAP_KEY=...
SECRET=...
KEY=...
```

package.json

```json
{
  "now": {
    "dotenv": "variables.env.now"
  },
  // ...
}
```


**?????**
Under scripts section in `package.json`  
`"now": "now -e DB_USER=@db_user -e DB_PASS=@db_pass -e NODE_ENV=\"production\" -e PORT=80"`







## 41 Deployment Setup

Initialize git by `$ git init`

Make `.gitignore` file

```
node_modules/
.DS_Store
*.log
.idea
variables.env
variables.env.now
```


Change scripts names in `package.json`
So then to develop use `$ npm run dev`
And `npm start` will work for prod app

```json
{
  "scripts": {
    "start": "node ./start.js",
    "dev": "concurrently \"npm run watch\" \"npm run assets\" --names \"💻,📦\" --prefix name"
  },
  // ...
}
```


For real mail delivery use https://postmarkapp.com/










# 40 Implementing Pagination

```js
// routes/index.js
// ...
router.get('/stores/page/:page', catchErrors(storeController.getStores))
```


```js
// controllers.storeController.js
// ...
exports.getStores = async (req, res) => {
    const page = req.params.page || 1
    const limit = 4
    const skip = page * limit - limit

    const storesPromise = Store.find()
        .skip(skip).limit(limit)
        .sort({ created: 'desc' })
    const countPromise = Store.count()
    const [stores, count] = await Promise.all([storesPromise, countPromise])

    const pages = Math.ceil(count / limit)

    if(!stores.length && skip) {
        req.flash('info', `Page ${page} doesn't exist. So put you on page ${pages}`)
        res.redirect(`/stores/page/${pages}`)
        return
    }

    res.render('stores', { title: 'Stores', stores, page, pages, count })
}
```


```pug
//- views/stores.pug
extends layout

include mixins/_storeCard
include mixins/_pagination

block content
  //- ...
  +pagination(page, pages, count)
```


```pug
//- views/mixins/_pagination.pug
mixin pagination(page, pages, count)
  .pagination
    .pagination__prev
      if page > 1
        a(href=`/stores/page/${page - 1}`) Prev
    .pagination__text
      p Page #{page} of #{pages} - #{count} total results
    .pagination__next
      if page < pages
        a(href=`/stores/page/${parseFloat(page) + 1}`) Next
```







# 39 Advanced Aggregation

Run after all changes
```bash 
npm run blowitallaway
npm run sample
npm start
```


```js
// data/load-sample-data.js
// ...
const Review = require('../models/Review');
// ...
const reviews = JSON.parse(fs.readFileSync(__dirname + '/reviews.json', 'utf-8'));
// ...
async function deleteData() {
  await Review.remove();
  // ...
}
// ...
async function loadData() {
  try {
    await Review.insertMany(reviews);
    // ...
  } catch(e) {
    // ...
  }
}
```


```js
// routes/index.js
// ...
router.get('/top', catchErrors(storeController.getTopStores))
```


```js
// controllers.storeController.js
exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores()
    res.render('topStores', { stores, title: 'Top Stores' })
}

// ...
function autopopulate(next) {
    this.populate('reviews')
    next()
}

storeSchema.pre('find', autopopulate)
storeSchema.pre('findOne', autopopulate)
```


```js
//  models/Store.js
storeSchema.statics.getTopStores = function() {
    return this.aggregate([
        // Lookup stores and populate their reviews
        // can't use virtual here
        { $lookup: {
            from: 'reviews', 
            localField: '_id', 
            foreignField: 'store', 
            as: 'reviews'
        } },
        // filter for only items that have 2 or more reviews
        // second item reviews.1 exists (and so first reviews.0)
        { $match: {
            'reviews.1': { $exists: true }
        } },
        // add the average review field and others
        { $project: {
            photo: '$$ROOT.photo',
            name: '$$ROOT.name',
            slug: '$$ROOT.slug',
            reviews: '$$ROOT.reviews',
            averageRating: { $avg: '$reviews.rating' }
        } },
        // sort it by our new field
        { $sort: { averageRating: -1 } },
        // limit to at most 10
        { $limit: 10 }
    ])
}
```


```pug
//- views/topStores
extends layout 

block content 
  .inner 
    h2 Top #{stores.length} Stores
    table.table 
      thead
        td Photo
        td Ranking
        td Name
        td Reviews
        td Average rating
      each store, i in stores
        tr
          td
            a(href=`/store/${store.slug}`)
              img(width=200 src=`/uploads/${store.photo || 'store.png'}` alt=store.name)
          td #{i + 1}
          //-   ':' to write in one line
          td: a(href=`/store/${store.slug}`)= store.name
          td= store.reviews.length
          td #{Math.round(store.averageRating * 10) / 10} / 5
```


```js
// view/mixins/_storeCard.pug
mixin storeCard(store = {})
  .store
    .store__hero
      .store__actions
        // ...
        if store.reviews
          .store__action.store__action--count
            != h.icon('review')
            span= store.reviews.length
```








## 38 Advanced relationship population

By default virtual fields accessible explicitly via pre= h.dump(store.reviews)
If you want them to be bringed to json you need put some options to schema

```js
// models/Store.js
// ...
const storeSchema = new mongoose.Schema({
    // ...
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})
// ...
storeSchema.virtual('reviews', {
    ref: 'Review', // what model to link
    localField: '_id', // which field on the store
    foreignField: 'store' // which field on the review
})
```


```js
// controllers/storeController.js
// ...
exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews')
    // ...
}
```


```js
// models/Review.js
// ...
function autopopulate(next) {
    this.populate('author')
    next()
}

reviewSchema.pre('find', autopopulate)
reviewSchema.pre('findOne', autopopulate)
```


```pug
//- views/store.pug
extends layout

include mixins/_reviewForm
include mixins/_review

block content
  //- pre= h.dump(store)
  //- pre= h.dump(store.reviews)
  //- ...
  if store.reviews
      .reviews
        each review in store.reviews
          .review
            +review(review)
```


```pug
//- views/mixins/_review.pug
mixin review(review)
  .review__header
    .review__author
      img.avatar(src=review.author.gravatar)
      p= review.author.name
    .review__stars(title=`Rated ${review.rating} out of 5 stars`)
      = `★`.repeat(review.rating)
      = `☆`.repeat(5 - review.rating)
    time.review__time(datetime=review.created)= h.moment(review.created).fromNow()
  .review__body
    p= review.text
```









## 37 Adding a reviews data model

```js
// models/Review
const mongoose = require('mongoose')
mongoose.Promise = global.Promise

const reviewSchema = new mongoose.Schema({
    created: {
        type: Date,
        default: Date.now
    },
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: 'You must supply an author!'
    },
    store: {
        type: mongoose.Schema.ObjectId,
        ref: 'Store',
        required: 'You nust supply a store!'
    },
    text: {
        type: String,
        required: 'Your review must have text!'
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    }
})

module.exports = mongoose.model('Review', reviewSchema)
```


```js
// start.js
// ...
// import all of our models
require('./models/Review')
// 
```


```pug
//- views/store.pug
extends layout
include mixins/_reviewForm
block content
//- ...
if user
      +reviewForm(store)
```


```pug
//- views/mixins/_reviewForm.pug
mixin reviewForm(store)
  form.reviewer(action=`/reviews/${store._id}` method="POST")
    textarea(name="text" placeholder="Did you try this place? Leave a review...")

    .reviewer__meta
      .reviewer__stars
        each num in [5,4,3,2,1]
          input(type="radio" id=`star${num}` name="rating" value=num required)
          label(for=`star${num}`) #{num} stars
      input.button(type="submit" value="Submit Review")
```


```js
// routes/index.js
const reviewController = require('../controllers/reviewController')
// ...
router.post('/reviews/:id', authController.isLoggedIn, catchErrors(reviewController.addReview))
```


```js
// controllers/reviewController.js
const mongoose = require('mongoose')
const Review = mongoose.model('Review')

exports.addReview = async(req, res) => {
  req.body.author = req.user._id
  req.body.store = req.params.id

  const newReview = new Review(req.body)
  await newReview.save()

  req.flash('success', 'Review saved!')
  res.redirect('back')
}
```


```css
/* public/sass/partials/_reviewer.css */
/*
  Reviewer Form
 */
.reviewer {
  position: relative;
  box-shadow: 0 0px 10px rgba(0,0,0,0.2);
  margin-bottom: 2rem;
  &__stars {
    display: flex;
    justify-content: center;
    input {
      display: none;
      &:checked {
        & ~ label {
          color: $yellow;
        }
      }
      & + label {
        font-size: 0;
        &:before {
          content: '★';
          font-size: 2rem;
        }
        /* These are in the opposite DOM order
           re-order them to be visually in normal order
           This is fine for accessibility because our labels have for()
         */
        &[for="star5"] { order: 5; }
        &[for="star4"] { order: 4; }
        &[for="star3"] { order: 3; }
        &[for="star2"] { order: 2; }
        &[for="star1"] { order: 1; }
        &:hover, &:hover ~ label {
          color: lighten($yellow,20%);
        }
      }
    }
  }
  textarea {
    border: 0;
    outline: 0;
    font-size: 2rem;
    padding: 2rem;
    height: 200px;
  }
  &__meta {
    display: flex;
    justify-content: center;
    align-items: center;
    border-top: 1px solid $grey;
    & > * {
      flex: 1;
    }
  }
}
```







## 36 Displaying hearted stores

```js
// routes/index.js
// ...
router.get('/hearts', authController.isLoggedIn, catchErrors(storeController.getHearts))
```


```js
// controllers/storeController.js
// ...
exports.getHearts = async(req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }
    })
    res.render('stores', { title: 'Hearted stores', stores })
}
```








## 35 

```js
// models/User.js
// ...
const userSchema = new Schema({
    // ...
    hearts: [
        { type: mongoose.Schema.ObjectId, ref: 'Store' }
    ]
})
// ...
```


```pug
//- views/mixins/_storeCard.pug
mixin storeCard(store = {})
  .store
    .store__hero
      .store__actions
        if user
          .store__action.store_action--heart
            form.heart(method="POST" action=`/api/stores/${store._id}/heart`)
              - const heartStrings = user.hearts.map((obj) => obj.toString())
              - const heartClass = heartStrings.includes(store._id.toString()) ? 'heart__button--hearted' : ''
              button.heart__button(type="submit" name="heart" class=heartClass)
                != h.icon('heart')
        //- ...
```


```pug
//- views/layout.pug
doctype html
html
  head
    //- ...
  body
    block header
      header.top
        nav.nav
          //- ...
          .nav__section.nav__section--user
            if user
              li.nav__item: a.nav__link(href="/hearts", class=(currentPath.startsWith('/hearts') ? 'nav__link--active' : ''))
                != h.icon('heart')
                span.heart-count #{user.hearts && user.hearts.length}
              //- ...
```


```js
// routes/index.js
// ...
router.post('/api/stores/:id/heart', catchErrors(storeController.heartStore))
```


```js
// controllers/storeController.js
const User = mongoose.model('User')
// ...
exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map((obj) => obj.toString())
    const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet'
    const user = await User.findByIdAndUpdate(req.user._id, {
        [operator]: { hearts: req.params.id }
    }, {
        new: true
    })
    res.json(user)
}
```


```js
// public/javascripts/modules/heart.js
import axios from 'axios'
import { $ } from './bling'

function ajaxHeart(e) {
    e.preventDeafult()
    axios.post(this.action)
        .then((res) => {
            // this.heart is a button
            const isHearted = this.heart.classList.toggle('heart__button--hearted')
            $('.heart-count').textContent = res.data.hearts.length
            if(isHearted) {
                this.heart.classList.add('heart__button--float')
                setTimeout(() => this.heart.classList.remove('heart__button--float'), 2500)
            }
        })
        .catch(console.error)
}

export default ajaxHeart
```


```js
// public/javascripts/delicious-app.js
import ajaxHeart from './modules/heart'
// ...
const heartForms = $$('form.heart')
heartForms.on('submit', ajaxHeart)
```


```css
/* public/sass/partials/_heart.scss */
.heart {
  &__button {
    background: none;
    border: 0;
    outline: 0;
    position: relative;
    &:after {
      content: '♥️';
      font-size: 20px;
      position: absolute;
      opacity: 0;
      top: 0;
    }
    svg {
      width: 25px;
      fill: white;
    }
    &--hearted {
      svg {
        fill: red;
      }
    }
    &--float {
      &:after {
        animation: fly 2.5s 1 ease-out;
      }
    }
  }
}

@keyframes fly {
  0% {
    transform: translateY(0);
    left: 0;
    opacity: 1;
  }
  20% { left: 20px; }
  40% { left: -20px; }
  60% { left: 20px; }
  80% { left: -20px; }
  100% {
    transform: translateY(-400px);
    opacity: 0;
    left: 20px;
  }
}
```







## 34 Plotting stores on a custom google map

```js
// routes/index.js
// ...
router.get('/map', storeController.mapPage)
```


```js
// controllers/storeController.js
// ...
exports.mapPage = (req, res) => {
    res.render('map', { title: 'Map' })
}
```


```pug
//- views/map
extends layout

block content
  .inner
    h2= title
    .map
      .autocomplete
        input.autocomplete__input(type="text" name="geolocate" placeholder="Search for anything")
      #map
        p Loading map...
```


```pug
//- views/layout.pug
//- ...
block scripts
      script(src=`https://maps.googleapis.com/maps/api/js?key=${process.env.MAP_KEY}&libraries=places`)
      script(src="/dist/App.bundle.js")
```


```js
// public/javascripts/delicious-app.js
// ...
import makeMap from './modules/map'

makeMap( $('#map') )
// ...
```


```js
// public/javascripts/modules/map.js
import axios from 'axios'
import { $ } from './bling'

const mapOptions = {
    center: { lat: 43.2, lng: -79.8 },
    zoom: 10
}

function loadPlaces(map, lat = 43.2, lng = -79.8) {
    axios.get(`/api/stores/near?lat=${lat}&lng=${lng}`)
        .then((res) => {
            const places = res.data
            if(!places.length) {
                alert('No places found!')
                return
            }

            // create a bounds
            const bounds = new google.maps.LatLngBounds()

            const infoWindow = new google.maps.InfoWindow()

            const markers = places.map((place) => {
                const [placeLng, placeLat] = place.location.coordinates
                const position = { lat: placeLat, lng: placeLng }

                bounds.extend(position)

                const marker = new google.maps.Marker({ map, position })
                marker.place = place
                return marker
            })

            markers.forEach((marker) => marker.addListener('click', function() {
                const html = `
                  <div class="popup">
                    <a href="/store/${this.place.slug}">
                      <img src="/uploads/${this.place.photo || 'store.png'}" alt="${this.place.name}" />
                      <p>${this.place.name} - ${this.place.location.address}</p>
                    </a>
                  </div>
                `
                infoWindow.setContent(html)
                infoWindow.open(map, this)
            }))

            map.setCenter(bounds.getCenter())
            map.fitBounds(bounds)
        })
}

function makeMap(mapDiv) {
    if(!mapDiv) return

    const map = new google.maps.Map(mapDiv, mapOptions)
    loadPlaces(map)

    const input = $('[name="geolocate"]')
    const autocomplete = new google.maps.places.Autocomplete(input)
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        loadPlaces(map, place.geometry.location.lat(), place.geometry.location.lng())
    })
}

export default makeMap
```







## 33 Creating a geospatial ajax endpoint

http://localhost:7777/api/stores/near?lat=43.2&lng=-79.8


```js
// models/Store.js
// ...
storeSchema.index({
    location: '2dsphere'
})
// ...
```


```js
// routes/index.js
// ...
router.get('/api/stores/near', catchErrors(storeController.mapStores))
```


```js
// controllers/storeController.js
// ...
exports.mapStores = async(req,res) => {
    const coordinates = [req.query.lng, req.query.lat].map(parseFloat)
    const q = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates
                },
                $maxDistance: 10000 // 10km
            }
        }
    }

    // const stores = await Store.find(q)
    // const stores = await Store.find(q).select('name photo')
    // const stores = await Store.find(q).select('-author -tags')
    const stores = await Store.find(q).select('slug name description location photo').limit(10)
    res.json(stores)
}
```










## 32 Creating an ajax search interface

```js
// public/javascripts/delicious-app.js
import typeAhead from './modules/typeAhead
// ...
typeAhead( $('.search') )
```


```js
// public/javascripts/modules/typeAhead.js
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
```






## 31 JSON endpoints and creating MongoDB indexes

```js
// models/Store.js
// ...
// Define indexes
storeSchema.index({
    name: 'text',
    description: 'text'
})
// ...
```


```js
// routes/index.js
// ...
/*
  API
*/

router.get('/api/search', catchErrors(storeController.searchStores))
```

```js
// controllers/storeController.js
// ...
exports.searchStores = async (req, res) => {
    const stores = await Store.find({
        $text: { $search: req.query.q }
    }, {
        score: { $meta: 'textScore' }
    })
    .sort({
        score: { $meta: 'textScore' }
    })
    .limit(5)
    res.json(stores)
}
```






## 30 Loading Sample Data

```json
// package.json
{
  // ...
  "scripts": {
    // ...
    "sample": "node ./data/load-sample-data.js",
    "blowitallaway": "node ./data/load-sample-data.js --delete",
  }
}
```

```js
// data/load-sample-data.js
require('dotenv').config({ path: __dirname + '/../variables.env' });
const fs = require('fs');

const mongoose = require('mongoose');
mongoose.connect(process.env.DATABASE);
mongoose.Promise = global.Promise; // Tell Mongoose to use ES6 promises

// import all of our models - they need to be imported only once
const Store = require('../models/Store');
// const Review = require('../models/Review');
const User = require('../models/User');


const stores = JSON.parse(fs.readFileSync(__dirname + '/stores.json', 'utf-8'));
// const reviews = JSON.parse(fs.readFileSync(__dirname + '/reviews.json', 'utf-8'));
const users = JSON.parse(fs.readFileSync(__dirname + '/users.json', 'utf-8'));

async function deleteData() {
  console.log('😢😢 Goodbye Data...');
  await Store.remove();
  // await Review.remove();
  await User.remove();
  console.log('Data Deleted. To load sample data, run\n\n\t npm run sample\n\n');
  process.exit();
}

async function loadData() {
  try {
    await Store.insertMany(stores);
    // await Review.insertMany(reviews);
    await User.insertMany(users);
    console.log('👍👍👍👍👍👍👍👍 Done!');
    process.exit();
  } catch(e) {
    console.log('\n👎👎👎👎👎👎👎👎 Error! The Error info is below but if you are importing sample data make sure to drop the existing database first with.\n\n\t npm run blowitallaway\n\n\n');
    console.log(e);
    process.exit();
  }
}
if (process.argv.includes('--delete')) {
  deleteData();
} else {
  loadData();
}
```


```json
// data/stores.json
```

```json
// data/users.json
```


```md
<!-- readme.md -->
<!-- ... -->
## Sample Data

To load sample data, run the following command in your terminal:
`npm run sample`

If you have previously loaded in this data, you can wipe your database 100% clean with:
`npm run blowitallaway`

That will populate 16 stores with 3 authors and 41 reviews. The logins for the authors are as follows:

|Name|Email (login)|Password|
|---|---|---|
|Wes Bos|wes@example.com|wes|
|Debbie Downer|debbie@example.com|debbie|
|Beau|beau@example.com|beau|
```






## 29 Locking down application with User Permissions

```js
// models/Store.js
// ...
const storeSchema = new mongoose.Schema({
    // ...
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }
})
// ...
```


```js
// controllers/storeController.js
// ...
exports.createStore = async (req, res) => {
    req.body.author = req.user._id
    const store = await (new Store(req.body)).save()
    // ...
}

const confirmOwner = (store, user) => {
    if(!store.author.equals(user._id)) {
        throw Error('You must own a store in order to edit it!')
    }
}

exports.editStore = async (req, res) => {
    const store = await Store.findOne({ _id: req.params.id })
    confirmOwner(store, req.user)
    res.render('editStore', { title: `Edit ${store.name}`, store })
}

exports.getStoreBySlug = async (req, res, next) => {
    // populate
    const store = await Store.findOne({ slug: req.params.slug }).populate('author')
    if(!store) return next()
    res.render('store', { store, title: store.name })
}
```


```pug
//- views/store
extends layout

block content
  //- ...
  pre= h.dump(store)
  //- "author": {
  //-   "_id": "63b3b7ca4eac230ac11adf40",
  //-   "email": "wesbos+randy@gmail.com",
  //-   "name": "Randy",
  //-   "__v": 0
  //- }
```


```pug
//- views/mixins/_storeCard.pug
mixin storeCard(store = {})
  .store
    .store__hero
      .store__actions
        if user && store.author.equals(user._id)
          .store__action.store__action--edit
            a(href=`/stores/${store._id}/edit`)
              != h.icon('pencil')
      //- ...
    pre= h.dump(store)
    //- "author": "63b3b7ca4eac230ac11adf40"
```







## 28 Sending email

mailtrap.io
a...@...ru
Ok****


```
...
MAIL_USER=123
MAIL_PASS=123
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
```


```js
// handlers/mail.js
const nodemailer = require('nodemailer')
const pug = require('pug')
const juice = require('juice')
const htmlToText = require('html-to-text')
const promisify = require('es6-promisify')

const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
})

const generateHtml = (filename, options = {}) => {
    const html = pug.renderFile(`${__dirname}/../views/email/${filename}.pug`, options)
    const inlined = juice(html)
    return inlined
}

exports.send = async (options) => {
    const html = generateHtml(options.filename, options)
    const text = htmlToText.fromString(html)

    const mailOptions = {
        from: 'Wes Bos <noreply@wesbos.com>',
        to: options.user.email,
        subject: options.subject,
        html,
        text
    }

    const sendMail = promisify(transport.sendMail, transport)
    return sendMail(mailOptions)
}
```


```js
// controllers/authController.js
const mail = require('../handlers/mail')
// ...
// Send them an email with the token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`

  await mail.send({
    user,
    filename: 'password-reset',
    subject: 'Password Reset',
    resetURL
  })

  req.flash('success', 'You have been emailed a password reset link')
  res.redirect('/login')
```


```pug
//- views/email/password-reset.pug
extends email-layout

block content
  h2 Password Reset
  p Hello. You have requested a password reset. Please click the following button to continue on with resetting your password. Please note this link is only valid for the next hour.
  +button(resetURL, 'Reset my Password →')
  p If you can't click the above button please visit #{resetURL}
  br
  p If you didn't request this email, please ignore it.
```


```pug
//- views/email/email-layout.pug
```







## 27 Password reset flow

```js
// routes/index.js
// ...
router.post('/account/forgot', catchErrors(authController.forgot))
router.get('/account/reset/:token', catchErrors(authController.reset))
router.post('/account/reset/:token', authController.confirmedPasswords, catchErrors(authController.update))
```


```pug
//- views/mixins/_forgotForm.pug
mixin forgotForm()
  form.form(action="/account/forgot" method="POST")
    h2 I forgot my password

    label(for="email") Email
    input(type="email" name="email")

    input.button(type="submit" value="Send a reset")
```


```pug
//- views/login
//- ...
+forgotForm()
```


```js
// models/User.js
// ...
const userSchema = new Schema({
    // ...
    resetPasswordToken: String,
    resetPasswordExpires: Date
})
// ...
```


```js
// controllers/authController.js
const mongoose = require('mongoose')
const User = mongoose.model('User')
const crypto = require('crypto')
const promisify = require('es6-promisify')
// ...
exports.forgot = async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  if(!user) {
    req.flash('error', 'No account with that email exists')
    return res.redirect('/login')
  }

  user.resetPasswordToken = crypto.randomBytes(20).toString('hex')
  user.resetPasswordExpires = Date.now() + 3600000
  await user.save()

  // Send them an email with the token
  const resetUrl = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`
  req.flash('success', `You have been emailed a password reset link ${resetUrl}`)

  res.redirect('/login')
}

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    })
    if(!user) {
        req.flash('error', 'Password reset is invalid or has expired')
        return res.redirect('/login')
    }

    res.render('reset', { title: 'Reset your password '})
}

exports.confirmedPasswords = (req, res, next) => {
    if(req.body.password === req.body['password-confirm']) {
        next()
        return
    }
    req.flash('error', 'Passwords do not match')
    res.redirect('back')
}

exports.update = async (req,res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    })
    if(!user) {
        req.flash('error', 'Password reset is invalid or has expired')
        return res.redirect('/login')
    }

    // promisify and bind to the user object
    const setPassword = promisify(user.setPassword, user)
    await setPassword(req.body.password)
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    const updatedUser = await user.save()
    
    await req.login(updatedUser)
    req.flash('success', 'Your password has been reset! You are now logged in')
    res.redirect('/')
}
```


```pug
//- views/reset.pug
extends layout

block content
  .inner
    h2= title
    form.form(method="POST")
      h2 Reset yout password

      label(for="password") Password
      input(type="password" name="password")

      label(for="password-confirm") Confirm password
      input(type="password" name="password-confirm")

      input.button(type="submit" value="Reset password")
```







## 26 Creating a user account edit screen

```js
// routes/index.js
// ...
router.get('/account', authController.isLoggedIn, userController.account)
router.post('/account', catchErrors(userController.updateAccount))
```


```js
// app.js
// ...
// pass variables to our templates + all requests
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  // ...
});
// ...
```


```js
// controllers/userController.js
// ...
exports.account = (req, res) => {
    res.render('account', { title: 'Edit your account' })
}

exports.updateAccount = async (req,res) => {
    const updates = {
        name: req.body.name,
        email: req.body.email
    }

    const user = await User.findOneAndUpdate(
        { _id: req.user._id },
        { $set: updates },
        { new: true, runValidators: true, context: 'query' }
    )

    req.flash('success', 'Updated the profile!')
    res.redirect('back')
}
```


```pug
//- views/account.pug
extends layout

block content
  .inner
    h2= title
    form(action="/account" method="POST")
      label(for="name") Name
      input(type="text" name="name" value=user.name)

      label(for="email") Email
      input(type="email" name="email" value=user.email)

      input.button(type="submit" value="Update Account")
```






## 25 Virtual Fields, Login-Logout middleware and Protecting Routes

```js
// routes/index.js
// ...
router.get('/add', authController.isLoggedIn, storeController.addStore);

router.get('/logout', authController.logout)
```


```js
// controllers/authController.js
// ...
exports.logout = (req, res) => {
    req.logout()
    req.flash('success', 'You are now logged out')
    res.redirect('/')
}


exports.isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated()) {
        next()
        return
    }
    req.flash('error', 'You must be logged in to do that!')
    res.redirect('/login')
}
```


```js
// models/User.js
const md5 = require('md5')
// ...
userSchema.virtual('gravatar').get(function() {
    const hash = md5(this.email)
    return `https://gravatar.com/avatar/${hash}?s=200`
})
```







## 24 Saving registered users to the database

```js
// models/User.js
const passportLocalMongoose = require('passport-local-mongoose')
// ...
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' })
```


```js
// routes/index.js
// ...
router.post('/login', authController.login)
router.post('/register',
  userController.validateRegister,
  userController.register,
  authController.login
)
```


```js
// controllers/userController.js
const mongoose = require('mongoose')
const User = mongoose.model('User')
const promisify = require('es6-promisify')
// ...
exports.register = async (req, res, next) => {
    const { email, name, password } = req.body
    const user = new User({ name, email })
    // User.register(user, password, function(err, user) {
    //     // ...
    // })
    // registerWithPromise
    const register = promisify(User.register, User)
    await register(user, password)
    next() // path to authController.login
}
```


```js
// controllers/authController.js
const passport = require('passport')

exports.login = passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Failed login!',
    successRedirect: '/',
    successFlash: 'You are now logged in!'
})
```


```js
// handlers/passport.js
const passport = require('passport')
const mongoose = require('mongoose')
const User = mongoose.model('User')

passport.use(User.createStrategy())

passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())
```


```js
// app.js
require('./handlers/passport')
// ...
```






## 23 Creating User Accounts

```js
// app.js
const expressValidator = require('express-validator');
// ...
// Exposes a bunch of methods for validating data. Used heavily on userController.validateRegister
app.use(expressValidator());
// ...
```


```js
// routes/index.js
// ...
router.get('/login', userController.loginForm)
router.get('/register', userController.registerForm)
router.post('/register', userController.validateRegister)
```


```js
// controllers/userController.js
exports.loginForm = (req, res) => {
    res.render('login', { title: 'Login' })
}

exports.registerForm = (req, res) => {
    res.render('register', { title: 'Register' })
}

exports.validateRegister = (req, res, next) => {
    req.sanitizeBody('name')
    req.checkBody('name', 'You must supply a name!').notEmpty()
    req.checkBody('email', 'That email is not valid!').isEmail()
    req.sanitizeBody('email').normalizeEmail({
        remove_dots: false,
        remove_extension: false,
        gmail_remove_subaddress: false
    })
    req.checkBody('password', 'Password cannot be blank!').notEmpty()
    req.checkBody('password-confirm', 'Confirmed password cannot be blank!').notEmpty()
    req.checkBody('password-confirm', 'Your passwords do not match!').equals(req.body.password)

    const errors = req.validationErrors()
    if(errors) {
        req.flash('error', errors.map(err => err.msg))
        res.render('register', { title: 'Register', body: req.body, flashes: req.flash() })
        return
    }

    next()
}
```


```pug
//- views/login
extends layout

include mixins/_loginForm

block content
  .inner
    h2= title
    +loginForm()
```


```pug
//- views/register
```


```js
// models/User.js
const mongoose = require('mongoose')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
const validator = require('validator')
const mongodbErrorHandler = require('mongoose-mongodb-errors')

const userSchema = new Schema({
    email: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Invalid email address'],
        required: 'Please supply an email address'
    },
    name: {
        type: String,
        trim: true,
        required: 'Please supply a name'
    }
})

userSchema.plugin(mongodbErrorHandler)

module.exports = mongoose.model('User', userSchema)
```


```js
// start.js
// ...
// import all of our models
require('./models/Store')
require('./models/User')
```






## 22 Multiple Query Promises with AsyncAwait

```js
// controllers/storeController.js
// ...
exports.getStoresByTag = async (req, res) => {
    const tag = req.params.tag
    const tagsPromise = Store.getTagsList()
    // const tagQuery = tag || { $exists: true }
    const storesPromise = Store.find({ tags: tag || { $exists: true } })
    const [tags, stores] = await Promise.all([ tagsPromise, storesPromise ])
    res.render('tags', { tag, tags, stores, title: 'Tags' })
}
```


```pug
//- views/tags.pug
extends layout

include mixins/_storeCard

block content
  .inner
    //- ...    
    .stores
      each store in stores
        +storeCard(store)
```






## 21 Custom MongoDB Aggregations

```js
// routes/index.js
// ...
router.get('/tags', catchErrors(storeController.getStoresByTag))
router.get('/tags/:tag', catchErrors(storeController.getStoresByTag))
```


```js
// controllers/storeControlle.js
// ...
exports.getStoresByTag = async (req, res) => {
    const tags = await Store.getTagsList()
    res.render('tags', { tags, title: 'Tags', tag: req.params.tag })
}
```


```js
// models/Store.js
// ...
storeSchema.statics.getTagsList = function() {
    return this.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ])
}
```


```pug
//- views/atgs.pug
extends layout

block content
  .inner
    h2= tag || 'Tags'
    ul.tags
      each t in tags
        li.tag
          a.tag__link(href=`/tags/${t._id}` class=(t._id === tag ? 'tag__link--active' : ''))
            span.tag__text= t._id
            span.tag__count= t.count
```






## 20 Using pre-save hooks to make unique slugs

```js
// models/Store.js
// ...
storeSchema.pre('save', async function(next) {
    // ...

    const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i')
    const storeWithSlug = await this.constructor.find({ slug: slugRegEx })
    if(storeWithSlug.length) {
        this.slug = `${this.slug}-${storeWithSlug.length + 1}`
    }

    next()
})
```





## 19 Routing and Templating Single Stores

```js
// routes/index.js
// ...
router.get('/store/:slug', catchErrors(storeController.getStoreBySlug));
```


```js
// controllers/storeController
// ...
exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug })
    if(!store) return next()
    res.render('store', { store, title: store.name })
}
```


```pug
//- views/store.pug
extends layout

block content
  .single
    .single__hero
      img.single__image(src=`/uploads/${store.photo || 'store.png'}`)
      h2.title.title--single
        a(href=`/store/${store.slug}`) #{store.name}

  .single__details.inner
    img.single__map(src=h.staticMap(store.location.coordinates))
    p.single__location= store.location.address
    p= store.description

    if store.tags
      ul.tags
        each tag in store.tags
          li.tag
            a.tag__link(href=`/tags/${tag}`)
              span.tag__text ##{tag}
```





## 18 Uploading and Resizing Images with Middleware

```pug
//- views/mixins/_storeForm.pug
mixin storeForm(store = {})
  form(action=`/add/${store._id || ''}` method="POST" class="card" enctype="multipart/form-data")
  //- ...
  //- Image upload
  label(for="photo")
  input(type="file" name="photo" id="photo" accept="image/gif, image/png, image/jpeg")
  if store.photo
    img(src=`/uploads/${store.photo}` alt=store.name width=200)
  //- ...
```


```js
// models/Store.js
// ...
const storeSchema = new mongoose.Schema({
    // ...
    photo: String
})
// ...
```


```js
// controllers/storeController.js
const multer = require('multer')
const jimp = require('jimp')
const uuid = require('uuid')

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/')
        if(isPhoto) {
            next(null, true)
        } else {
            next({ message: 'That filetype isn\'t allowed!' }, false)
        }
    }
}

exports.upload = multer(multerOptions).single('photo')

exports.resize = async(req, res, next) => {
    if(!req.file) {
        next()
        return
    }

    const extension = req.file.mimetype.split('/')[1]
    const filename = `${uuid.v4()}.${extension}`
    req.body.photo = filename

    const photo = await jimp.read(req.file.buffer)
    await photo.resize(800, jimp.AUTO)
    await photo.write(`./public/uploads/${filename}`)

    next()
}
// ...
```


```js
// routes/index.js
// ...
router.post('/add',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.createStore)
);

router.post('/add/:id',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.updateStore)
);
// ...
```




## 17 Data visualization tip

```js
// controllers/storeController.js
// ...
exports.updateStore = async (req, res) => {
    // set the location data to be a point
    req.body.location.type = 'Point'
    // ...
}
```






## 16 Geocoding data with Google Maps

```js
// public/javascripts/modules/autocomplete.js
function autocomplete(input, latInput, lngInput) {
    if(!input) return // skip this fn from running if there not input on the page

    const dropdown = new google.maps.places.Autocomplete(input)

    dropdown.addListener('place_changed', () => {
        const place = dropdown.getPlace()
        // latInput.value = place.geometry.location.lat()
        latInput.value = 48.85661400000001
        // lngInput = place.geometry.location.lng()
        lngInput = 2.3522219000000177
    })

    // if someone hits enter on the address field, don't submit the form
    input.on('keydown', () => {
        if(e.keyCode === 13) e.preventDefault()
    })
}

export default autocomplete
```


```js
// public/javascripts/delicious-app.js
import '../sass/style.scss'

import { $, $$ } from './modules/bling'
import autocomplete from './modules/autocomplete'

autocomplete($('#address'), $('#lat'), $('#lng'))
```


```js
// public/javascripts/modules/bling.js
// based on https://gist.github.com/paulirish/12fb951a8b893a454b32

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

Node.prototype.on = window.on = function (name, fn) {
  this.addEventListener(name, fn);
};

NodeList.prototype.__proto__ = Array.prototype; // eslint-disable-line

NodeList.prototype.on = NodeList.prototype.addEventListener = function (name, fn) {
  this.forEach((elem) => {
    elem.on(name, fn);
  });
};

export { $, $$ };
```





## 15 Saving lat and lng

```js
// models/Store.js
// ...
const storeSchema = new mongoose.Schema({
    // ...
    created: {
        type: Date,
        default: Date.now
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [{
            type: Number,
            required: 'You must supply coordinates!'
        }],
        address: {
            type: String,
            required: 'You must supply an address!'
        }
    }
})
// ...
```


```pug
//- views/mixins/_storeForm.pug
//- ...
//- address, lng and lat
label(for="address") Address
//- location[address] due to app.use(express.urlencoded({ extended: true })) in app.js
input(type="text" id="address" name="location[address]" value=(store.location && store.location.address))

label(for="lng") Longitude
input(type="text" id="lng" name="location[coordinates][0]" value=(store.location && store.location.coordinates[0]))
label(for="lat") Latitude
input(type="text" id="lat" name="location[coordinates][1]" value=(store.location && store.location.coordinates[1]))
//- ...
```


```js
// app.js
// ...
// One of our error handlers will see if these errors are just validation errors
app.use(errorHandlers.flashValidationErrors);
```


```js
// handlers/errorHandlers.js
// ...
/*
  MongoDB Validation Error Handler
  Detect if there are mongodb validation errors that we can nicely show via flash messages
*/
exports.flashValidationErrors = (err, req, res, next) => {
  if (!err.errors) return next(err);
  // validation errors look like
  const errorKeys = Object.keys(err.errors);
  errorKeys.forEach(key => req.flash('error', err.errors[key].message));
  res.redirect('back');
};
```





## 14 Creating and editing flow for stores

```js
// routes/index.js
// ...
router.get('/stores/:id/edit', catchErrors(storeController.editStore));
router.post('/add/:id', catchErrors(storeController.updateStore));
// ...
```


```js
// controllers/storeController.js
// ...
exports.editStore = async (req, res) => {
    const store = await Store.findOne({ _id: req.params.id })
    // res.json(store)
    res.render('editStore', { title: `Edit ${store.name}`, store })
}

exports.updateStore = async (req, res) => {
    const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
        new: true, // return the new store instead of the old one
        runValidators: true 
    }).exec()
    req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/store/${store.slug}">View store</a>`)
    res.redirect(`/stores/${store._id}/edit`)
}
```


```pug
//- views/editStore.pug
//- ...
+storeForm(store)
```


```pug
//- views/mixins/_storeForm.pug
mixin storeForm(store = {})
  form(action=`/add/${store._id || ''}` method="POST" class="card")
    label(for="name") Name
    input(type="text" name="name" id="name" value=store.name)

    label(for="description") Description
    textarea(name="description" id="description")= store.description

    - const choices = ['Wifi', 'Open Late', 'Family Friendly', 'Vegetarian', 'Licensed']
    - const tags = store.tags || []
    ul.tags
      each choice in choices
        .tag.tag__choice
          input(type="checkbox" id=choice value=choice name="tags" checked=(tags.includes(choice)))
          label(for=choice) #{choice}

    input(type="submit" value="Save →" class="button")
```



## 13 Querying database for stores

```js
// routes/index.js
...
router.get('/', catchErrors(storeController.getStores));
router.get('/stores', catchErrors(storeController.getStores));
...
```


```js
// controllers/storeController.js
...
exports.getStores = async (req, res) => {
    const stores = await Store.find()
    res.render('stores', { title: 'Stores', stores })
}
```


```pug
//- views/stores.pug
extends layout

include mixins/_storeCard

block content
  h1= title
  //- pre= h.dump(stores)
  .stores
    each store in stores
      +storeCard(store)
```


```pug
//- views/mixins/_storeCard.pug
mixin storeCard(store = {})
  .store
    .store__hero
      .store__actions
        .store__action.store__action--edit
          a(href=`/stores/${store._id}/edit`)
            != h.icon('pencil')
      img(src=`/uploads/${store.photo || 'store.png'}`)
      h2.title
        //- a(href=`/store/${store.slug}`) #{store.name}
        a(href=`/store/${store.slug}`)= store.name
    .store__description
      p= store.description.split( ).slice(0, 25).join(' ')
```




## 12 Flash messages

```js
// app.js
const flash = require('connect-flash');
...
// Sessions allow us to store data on visitors from request to request
// This keeps users logged in and allows us to send flash messages
app.use(session({
  secret: process.env.SECRET,
  key: process.env.KEY,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongoUrl: process.env.DATABASE })
}));

// The flash middleware let's us use req.flash('error', 'Shit!'), which will then pass that message to the next page the user requests
app.use(flash());


// pass variables to our templates + all requests
app.use((req, res, next) => {
  ...
  res.locals.flashes = req.flash();
  next();
});
...
```

```js
// controllers/storeController.js
...
exports.createStore = async (req, res) => {
    const store = await (new Store(req.body)).save()
    req.flash('success', `Succesfully created ${store.name}`)
    res.redirect(`/store/${store.slug}`)
};
```


```pug
//- views/layout.pug
//- ...
block messages
      if locals.flashes
        .inner
          .flash-messages
            - const categories = Object.keys(locals.flashes)
            each category in categories
              each message in flashes[category]
                .flash(class=`flash--${category}`)
                  //- != parses html inside message
                  p.flash__text!= message
                  button.flash__remove(onClick="this.parentElement.remove()") &times;
```



## 11 using async await

```js
// controllers/storeController.js
const mongoose = require('mongoose');
const Store = mongoose.model('Store')
...
exports.createStore = async (req, res) => {
    const store = new Store(req.body)
    // store
    //     .save()
    //     .then(store => {
    //         res.json(store)
    //     })
    //     .catch(err => {
    //         throw Error(err)
    //     })
    await store.save()
    res.redirect('/')
};
```


```js
// handlers/errorHandlers.js
exports.catchErrors = (fn) => {
  return function(req, res, next) {
    return fn(req, res, next).catch(next);
  };
};
```


```js
// routes/index.js
const { catchErrors } = require('../handlers/errorHandlers')
...
router.post('/add', catchErrors(storeController.createStore));
```






## 10

```js
// routes/index.js
...
router.get('/add', storeController.addStore);
router.post('/add', storeController.createStore);
...
```


```js
// controllers/storeController.js
...

exports.addStore = (req, res) => {
    res.render('editStore', { title: 'Add Store' });
};
  
exports.createStore = (req, res) => {
    res.json(req.body);
};
```


```pug
//- views/editStore.pug
extends layout

include mixins/_storeForm

block content
  .inner
    h2= title
    +storeForm()
```


```pug
//- views/mixins/_storeForm.pug
mixin storeForm(store = {})
  form(action="/add" method="POST" class="card")
    label(for="name") Name
    input(type="text" name="name" id="name")

    label(for="description") Description
    textarea(name="description" id="description")

    - const choices = ['Wifi', 'Open Late', 'Family Friendly', 'Vegetarian', 'Licensed']
    ul.tags
      each choice in choices
        .tag.tag__choice
          input(type="checkbox" id=choice value=choice name="tags")
          label(for=choice) #{choice}

    input(type="submit" value="Save →" class="button")
```



## 9 Creating Store Model

```js
// models/Store.js
const mongoose = require('mongoose')
mongoose.Promise = global.Promise
const slug = require('slugs')

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: 'Please enter a name!'
    },
    slug: String,
    description: {
        type: String,
        trim: true
    },
    tags: [String]
})

storeSchema.pre('save', function(next) {
    if(!this.isModified('name')) {
        next() // skip it
        return // stop this function from running
        // or one line 
        // return next()
    }
    this.slug = slug(this.name)
    next()
    // TODO make more resilient so slugs are unique
})

module.exports = mongoose.model('Store', storeSchema)
```

```js
// start.js
...
// import all of our models
require('./models/Store')
...
```




## 8 Core concept - Middleware and Error Handling

```js
// routes/index.js
...
// Route specific middleware
router.get('/', storeController.myMiddleware, storeController.homePage);
```


```js
// controllers/storeController.js
exports.myMiddleware = (req, res, next) => {
    req.name = 'Wes'
    res.cookie('name', 'Wes is cool', { maxAge: 9000000 })
    // if(req.name === 'Wes') {
    //     throw Error('That is a stupid name')
    // }
    next()
}

exports.homePage = (req, res) => {
    console.log(req.name)
    res.render('index')
}
```


```js
// app.js
...
// Global middlewares, before router
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
...
app.use('/', routes);
...
app.use(errorHandlers.notFound);
app.use(errorHandlers.productionErrors);
```




## 7 Core concept - Controllers and the MVC Pattern

```js
// routes/index.js
const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController')

// Do work here
router.get('/', storeController.homePage);

module.exports = router;
```


```js
// controllers/storeController.js
exports.homePage = (req, res) => {
    res.render('index')
}
```


```jade
//- views/index.pug
extends layout

block content
  p Hi
```




## 6 Core concept - Template Helpers

```js
// app.js
const helpers = require('./helpers');
...
// pass variables to our templates + all requests
app.use((req, res, next) => {
  res.locals.h = helpers;
  res.locals.flashes = req.flash();
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
});
...
```

```js
// helpers.js
...
// Some details about the site
exports.siteName = `Now That's Delicious!`;

exports.menu = [
  { slug: '/stores', title: 'Stores', icon: 'store', },
  { slug: '/tags', title: 'Tags', icon: 'tag', },
  { slug: '/top', title: 'Top', icon: 'top', },
  { slug: '/add', title: 'Add', icon: 'add', },
  { slug: '/map', title: 'Map', icon: 'map', },
];
```

```jade
//- views/layout.pug
doctype html
html
  head
    //- locals.h.siteName
    title= `${title} | ${h.siteName}`
    link(rel='stylesheet', href='/dist/style.css')
    link(rel="shortcut icon" type="image/png" href="/images/icons/doughnut.png")
    meta(name="viewport" content="width=device-width, initial-scale=1")
  body
    block header
      header.top
    //-   ...
```



## 5 Core concept - Templating

```js
// app.js
...
// view engine setup
app.set('views', path.join(__dirname, 'views')); // this is the folder where we keep our pug files
app.set('view engine', 'pug'); // we use the engine pug, mustache or EJS work great too
...
```

```js
// routes/index.js
const express = require('express');
const router = express.Router();

// Do work here
router.get('/', (req, res) => {
  // res.render('hello')
  res.render('hello', {
    name: 'wes',
    // dog: 'snickers',
    dog: req.query.dog,
    title: 'I love food'
  })
});

module.exports = router;
```

http://localhost:7777/?dog=snickers


```jade
//- views/hello.pug
extends layout

//- To overwrite default header
//- block header
  h2 Yo!

block content
    //- div.wrapper
    .wrapper.another-class
    p.hello Hello!
        span#yo Yo!

    p My name is #{name}
    p My dogs name is #{dog}

    - const upDog = dog.toUpperCase()
    p My dogs name is #{upDog}

    //- img(src="dog.jpg", alt="Dog")
    //- img.dog(src="dog.jpg" alt="Dog")
    img.dog(src="dog.jpg" alt=`Dog ${dog}`)

    h2 Hello
        em How are you?

    h2
        | Also hello
```

```jade
//- views/layout.pug
doctype html
html
  head
    title= `${title} | ${h.siteName}`
    link(rel='stylesheet', href='/dist/style.css')
    link(rel="shortcut icon" type="image/png" href="/images/icons/doughnut.png")
    meta(name="viewport" content="width=device-width, initial-scale=1")
  body
    block header
      header.top
        //- ...

    block messages
      if locals.flashes
        .inner
          .flash-messages
            - const categories = Object.keys(locals.flashes)
            each category in categories
              each message in flashes[category]
                .flash(class=`flash--${category}`)
                  p.flash__text!= message
                  button.flash__remove(onClick="this.parentElement.remove()") &times;
    .content
      block content

    block scripts
      script(src=`https://maps.googleapis.com/maps/api/js?key=${process.env.MAP_KEY}&libraries=places`)
      script(src="/dist/App.bundle.js")
```




## 4 Core concept - Routing

```js
// app.js
const express = require('express');
const routes = require('./routes/index');
...
// Takes the raw requests and turns them into usable properties on req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
...
// After allllll that above middleware, we finally handle our own routes!
app.use('/', routes);
```


```js
// routes/index.js
const express = require('express');
const router = express.Router();

// Do work here
router.get('/', (req, res) => {
  // res.send('Hey! It works!');
  // res.json({ say: 'Hey! It works!', also: 111 });
  // res.send(req.query.name)
  res.json(req.query)
});

router.get('/reverse/:name', (req, res) => {
  res.send(req.params.name)
})

module.exports = router;
```




## 3 Starter files and environmental variables

Start app (package.json scripts)
`$ npm start`

```js
// app.js
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const promisify = require('es6-promisify');
const flash = require('connect-flash');
const expressValidator = require('express-validator');

const routes = require('./routes/index');
const helpers = require('./helpers');
const errorHandlers = require('./handlers/errorHandlers');

// create our Express app
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views')); // this is the folder where we keep our pug files
app.set('view engine', 'pug'); // we use the engine pug, mustache or EJS work great too

// serves up static files from the public folder. Anything in public/ will just be served up as the file it is
app.use(express.static(path.join(__dirname, 'public')));

// Takes the raw requests and turns them into usable properties on req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Exposes a bunch of methods for validating data. Used heavily on userController.validateRegister
app.use(expressValidator());

// populates req.cookies with any cookies that came along with the request
app.use(cookieParser());

// Sessions allow us to store data on visitors from request to request
// This keeps users logged in and allows us to send flash messages
app.use(session({
  secret: process.env.SECRET,
  key: process.env.KEY,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongoUrl: process.env.DATABASE })
}));

// Passport JS is what we use to handle our logins
app.use(passport.initialize());
app.use(passport.session());

// The flash middleware let's us use req.flash('error', 'Shit!'), which will then pass that message to the next page the user requests
app.use(flash());

// pass variables to our templates + all requests
app.use((req, res, next) => {
  res.locals.h = helpers;
  res.locals.flashes = req.flash();
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
});

// promisify some callback based APIs
app.use((req, res, next) => {
  req.login = promisify(req.login, req);
  next();
});

// After allllll that above middleware, we finally handle our own routes!
app.use('/', routes);

// If that above routes didnt work, we 404 them and forward to error handler
app.use(errorHandlers.notFound);

// One of our error handlers will see if these errors are just validation errors
app.use(errorHandlers.flashValidationErrors);

// Otherwise this was a really bad error we didn't expect! Shoot eh
if (app.get('env') === 'development') {
  /* Development Error Handler - Prints stack trace */
  app.use(errorHandlers.developmentErrors);
}

// production error handler
app.use(errorHandlers.productionErrors);

// done! we export it so we can start the site in start.js
module.exports = app;
```

```js
// start.js
const mongoose = require('mongoose');

// Make sure we are running node 7.6+
const [major, minor] = process.versions.node.split('.').map(parseFloat);
if (major < 7 || (major === 7 && minor <= 5)) {
  console.log('🛑 🌮 🐶 💪 💩\nHey You! \n\t ya you! \n\t\tBuster! \n\tYou\'re on an older version of node that doesn\'t support the latest and greatest things we are learning (Async + Await)! Please go to nodejs.org and download version 7.6 or greater. 👌\n ');
  process.exit();
}

// import environmental variables from our variables.env file
require('dotenv').config({ path: 'variables.env' });

// Connect to our Database and handle any bad connections
mongoose.connect(process.env.DATABASE);
mongoose.Promise = global.Promise; // Tell Mongoose to use ES6 promises
mongoose.connection.on('error', (err) => {
  console.error(`🙅 🚫 🙅 🚫 🙅 🚫 🙅 🚫 → ${err.message}`);
});

// READY?! Let's go!


// Start our app!
const app = require('./app');
app.set('port', process.env.PORT || 7777);
const server = app.listen(app.get('port'), () => {
  console.log(`Express running → PORT ${server.address().port}`);
});
```




## 2 Setting up MongoDB

### Cloud

Open MongoDB Atlas (not mlab.com) - hosted MongoDB service option in the cloud
https://www.mongodb.com/atlas/database

Create database

Rename file `variables.env.sample` to `variables.env`  
Use DATABASE for connection

Download `MongoDB Compass` and use as MongoDB GUI


### Local

You may need to install Xcode command-kine tools `$ xcode-select --install`  
Check if you have it `$ /usr/bin/xcodebuild -version`  

You need `homebrew` been installed, instructions https://brew.sh/#install  

`$ brew tap mongodb/brew`

Follow instructions  
https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/  
https://github.com/mongodb/homebrew-brew




## 1 Getting setup

Check version, need > 7.6 (nodejs.org)
`$ node -v`

Copy files from `starter-files` folder
https://github.com/wesbos/Learn-Node

Install packages
`$ npm install`
