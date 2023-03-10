const mongoose = require('mongoose');
const Store = mongoose.model('Store')
const User = mongoose.model('User')
const multer = require('multer')
const jimp = require('jimp')
const uuid = require('uuid');
const { es } = require('faker/lib/locales');

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

exports.homePage = (req, res) => {
    res.render('index')
}

exports.addStore = (req, res) => {
    res.render('editStore', { title: 'Add Store' });
};

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

exports.createStore = async (req, res) => {
    req.body.author = req.user._id
    // const store = new Store(req.body)
    // store
    //     .save()
    //     .then(store => {
    //         res.json(store)
    //     })
    //     .catch(err => {
    //         throw Error(err)
    //     })
    const store = await (new Store(req.body)).save()
    req.flash('success', `Succesfully created ${store.name}`)
    res.redirect(`/store/${store.slug}`)
};

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

const confirmOwner = (store, user) => {
    if(!store.author.equals(user._id)) {
        throw Error('You must own a store in order to edit it!')
    }
}

exports.editStore = async (req, res) => {
    const store = await Store.findOne({ _id: req.params.id })
    // res.json(store)
    confirmOwner(store, req.user)
    res.render('editStore', { title: `Edit ${store.name}`, store })
}

exports.updateStore = async (req, res) => {
    // set the location data to be a point
    req.body.location.type = 'Point'

    const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
        new: true, // return the new store instead of the old one
        runValidators: true 
    }).exec()
    req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/store/${store.slug}">View store</a>`)
    res.redirect(`/stores/${store._id}/edit`)
}

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews')
    if(!store) return next()
    res.render('store', { store, title: store.name })
}

exports.getStoresByTag = async (req, res) => {
    const tag = req.params.tag
    const tagsPromise = Store.getTagsList()
    // const tagQuery = tag || { $exists: true }
    const storesPromise = Store.find({ tags: tag || { $exists: true } })
    const [tags, stores] = await Promise.all([ tagsPromise, storesPromise ])
    res.render('tags', { tag, tags, stores, title: 'Tags' })
}

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

exports.mapPage = (req, res) => {
    res.render('map', { title: 'Map' })
}

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

exports.getHearts = async(req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }
    })
    res.render('stores', { title: 'Hearted stores', stores })
}

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores()
    res.render('topStores', { stores, title: 'Top Stores' })
}