import express from 'express'
import dotenv from 'dotenv'
import { connectToDB } from './database/db.js'
// Registers every model with Sequelize before sync() runs.
import './schemas/index.js'
import router from './routes/index.js'
import morgan from 'morgan';
import type { RequestHandler } from 'express';
import cors from "cors"
import cookieParser from 'cookie-parser'
import { config } from './config/config.js'
dotenv.config();


//routes
const port = process.env.PORT

const app = express()

//middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev') as RequestHandler)
app.use(cookieParser())


// The session travels in a cookie, so the origin has to be named explicitly:
// a browser will not send credentials to a wildcard origin. In production the
// terminals reach the API through the Next.js server on the same origin, and
// this list only matters when calling the API directly during development.
app.use(cors({
    origin: config.cors.origins,
    credentials: true
}))


//routes
router(app)

connectToDB()

app.get('/', (req: any, res: any) => {
    res.send('Backend Connected Successfully')
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})
