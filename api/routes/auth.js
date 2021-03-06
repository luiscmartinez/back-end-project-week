require('dotenv').config()
const server = require('express')()
const jtw = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
var Sequelize = require('sequelize')

var sequelize = new Sequelize('localhost_8000', 'root', 'password', {
  host: 'localhost:8000',
  dialect: 'sqlite'
})

var Users = sequelize.define('Users', {
  username: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  }
})

var Notes = sequelize.define('Notes', {
  title: {
    type: Sequelize.STRING,
    allowNull: false
  },
  context: {
    type: Sequelize.TEXT,
    allowNull: false
  }
})

let Tags = sequelize.define('Tags', {
  value: Sequelize.STRING
})

Users.hasMany(Notes)
Notes.belongsTo(Users)
Notes.hasMany(Tags)
Tags.belongsTo(Notes)
sequelize.sync()

// Users.create({
//   username: 'yLuis',
//   password: 'password'
// }).then((user) => {
//   user
//     .createNote({
//       title: 'run me over. 18 whe',
//       context: 'thiss might work'
//     })
//     .then((note) => {
//       note.createTag({
//         value: 'heello'
//       })
//     })
//     .then(() => console.log('worked...'))
// })

function getToken (user) {
  console.log('IN TOKKEN', user)
  const payload = {
    userId: user.id
  }
  return jtw.sign(payload, process.env.SECRET, {
    expiresIn: '1d'
  })
}

function register (req, res, next) {
  let { password, username } = req.body
  console.log(req.body)
  password = bcrypt.hashSync(password, 10)
  Users.create({
    username: username,
    password: password
  })
    .then((insertedUser) => {
      const token = getToken(insertedUser)
      res.status(201).json({ token: token })
    })
    .catch(next)
}
function login (req, res, next) {
  const credentials = req.body
  Users.findOne({
    where: { username: `${credentials.username}` }
  })
    .then((insertedUser) => {
      console.log('DATAVALUES', insertedUser.dataValues)
      let user = insertedUser.dataValues
      const lol = bcrypt.compareSync(credentials.password, user.password)
      if (lol === true) {
        const token = getToken(user)
        res.status(200).json({ mes: 'Logged In', token })
      } else {
        return res.status(401).json({ error: 'U shall not pass!' })
      }
    })
    .catch(next)
}
function getNotes (req, res, next) {
  const { userId } = req.token
  Notes.findAll({
    where: {
      userId
    },
    include: {
      model: Tags
    }
  }).then((response) => {
    const notes = response.map((Notes) => {
      return Object.assign(
        {},
        {
          id: Notes.dataValues.id,
          user_id: Notes.dataValues.UserId,
          title: Notes.dataValues.title,
          context: Notes.dataValues.context,
          tags: Notes.dataValues.Tags.map((Tag) => {
            return Tag.dataValues.value
          })
        }
      )
    })
    console.log('HERE SHOULD BE ALL USERS NOTES', notes)
    res.status(200).json(notes)
  })
}

function getNote (req, res, next) {
  Notes.findAll({
    where: { id: req.params.id },
    include: { model: Tags }
  }).then((insertedNote) => {
    const note = insertedNote.map((Notes) => {
      return Object.assign(
        {},
        {
          id: Notes.dataValues.id,
          title: Notes.dataValues.title,
          context: Notes.dataValues.context,
          tags: Notes.dataValues.Tags.map((Tag) => {
            return Tag.dataValues.value
          })
        }
      )
    })
    console.log('GET A NOTE', note)
    res.status(200).json(note[0])
  })
}

function newNote (req, res, next) {
  console.log('NEWNOTE', req.body)
  const { userId } = req.token
  const { title, context, tags } = req.body
  if (!tags) {
    Notes.create({
      title: title,
      context: context,
      UserId: userId
    })
    res.status(201).json({ note: req.body })
  } else {
    Notes.create({
      title: title,
      context: context,
      UserId: userId
    }).then((note) => {
      const tagArr = req.body.tags.split(' ')
      tagArr.forEach((tag) => {
        note.createTag({ value: tag })
        res.status(201).json({ note })
      })
    })
  }
}

function copy (req, res, next) {
  console.log('IN NEW NOT CONTROLLER', req.body)
  const { userId } = req.token
  const { title, context, tags } = req.body
  console.log(tags)
  Notes.create({
    title: title,
    context: context,
    UserId: userId
  }).then((note) => {
    tags.forEach((tag) => {
      note.createTag({ value: tag })
    })
  })
}

const restricted = (req, res, next) => {
  let newtoken = req.headers.authorization.split('')
  newtoken.shift()
  newtoken.pop()
  let token = newtoken.join('')
  console.log('token innn Restricted ,', token)
  if (token) {
    jtw.verify(token, process.env.SECRET, (err, decodedToken) => {
      if (err) {
        console.log('THERE WAS AN ERROR')
        return res
          .status(401)
          .json({ error: 'you shall not pass!! - token invalid' })
      }
      console.log('decoded', decodedToken)
      req.token = decodedToken
      next()
    })
  } else {
    console.log('NO HEREEEE')
    return res.status(401).json({ error: 'you shall not pass!! - no token' })
  }
}

function deleteNote (req, res, next) {
  console.log(req.params)
  Notes.destroy({
    where: {
      id: req.params.id
    }
  }).then((insertedNote) => {
    res.status(200).json(insertedNote) // returns 1
  })
}

function updateNote (req, res, next) {
  Notes.update(
    {
      title: req.body.title,
      context: req.body.context
    },
    { where: { id: req.params.id } }
  ).then((note) => {
    if (!req.body.tags) {
      res.status(200).json({ note }) // returns one
    }
    const tags = req.body.tags
    let tagArr = tags.split(' ')
    tagArr.forEach((tag) => {
      Tags.create({
        value: tag,
        NoteId: req.params.id
      })
      res.status(200).json({ note }) // returns one
    })
  })
}

function updateNoteWidTag (req, res, next) {
  Notes.update(
    {
      title: req.body.title,
      context: req.body.context
    },
    { where: { id: req.params.id } }
  ).then((note) => {
    const tags = req.body.tags
    let tagArr = tags.split(' ')
    Tags.destroy({ where: { NoteId: req.params.id } })
    tagArr.forEach((tag) => {
      Tags.create({
        value: tag,
        NoteId: req.params.id
      })
      res.status(200).json({ note }) // returns one
    })
  })
}

server.post('/register', register)
server.post('/login', login)
server.get('/notes', restricted, getNotes)
server.get('/note/:id', getNote)
server.post('/create', restricted, newNote)
server.post('/duplicate', restricted, copy)
server.delete('/delete/:id', deleteNote)
server.put('/edit/tag/:id', updateNoteWidTag)
server.put('/edit/:id', updateNote)

module.exports = server
