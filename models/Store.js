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
    tags: [String],
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
    },
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Define indexes
storeSchema.index({
    name: 'text',
    description: 'text'
})

storeSchema.index({
    location: '2dsphere'
})

storeSchema.pre('save', async function(next) {
    if(!this.isModified('name')) {
        next() // skip it
        return // stop this function from running
        // or one line 
        // return next()
    }
    this.slug = slug(this.name)

    const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i')
    const storeWithSlug = await this.constructor.find({ slug: slugRegEx })
    if(storeWithSlug.length) {
        this.slug = `${this.slug}-${storeWithSlug.length + 1}`
    }

    next()
})

storeSchema.statics.getTagsList = function() {
    return this.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ])
}

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

storeSchema.virtual('reviews', {
    ref: 'Review', // what model to link
    localField: '_id', // which field on the store
    foreignField: 'store' // which field on the review
})

function autopopulate(next) {
    this.populate('reviews')
    next()
}

storeSchema.pre('find', autopopulate)
storeSchema.pre('findOne', autopopulate)

module.exports = mongoose.model('Store', storeSchema)