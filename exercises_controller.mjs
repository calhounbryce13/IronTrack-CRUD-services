/**
 * Author: Bryce Calhoun
 * Description: Backend controller file for IronTrack's REACT frontend.
 */
import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcrypt';
import asyncHandler from 'express-async-handler';
import * as exercises from './exercises_model.mjs';
import cors from 'cors';
import nodemailer from 'nodemailer';
import session from 'express-session';

const PORT = process.env.PORT;
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}))
app.use(cors({
    origin:'http://127.0.0.1:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ["Content-Type"]
}));
app.use(session({
    secret: "to you, from me again",
    saveUninitialized: false,
    resave: false,
    cookie: {
        httpOnly: true,
        secure: false,    
        sameSite: 'lax'
    }
}));

/////////////////////////////////////////////////////////////////////////////////////////////

const valid_units = function(unit){
    if(unit.toLowerCase() === 'lbs' || unit.toLowerCase() === 'kgs'){
        return true;
    }
    return false;
}

const valid_date = function(date){
    const format = /^\d\d-\d\d-\d\d$/;
    return format.test(date);
}

const validate_request_body = function(body){
    const {name, reps, weight, unit, date} = body;
    if((name && reps && weight && unit && date)){
        if(typeof(name) == 'string'){
            if(typeof(reps) == 'number'){
                if(typeof(weight) == 'number'){
                    if(typeof(unit) == 'string'){
                        if(typeof(date) == 'string'){
                            if((reps > 0) && (weight > 0) && (name.length > 0) && valid_units(unit) && valid_date(date)){
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    return false
}

const postman = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth:{
        user: "calhounbryce13@gmail.com",
        pass: process.env.EMAIL_PASSWORD
    }
});

const send_confirmation_email = async(email)=>{
    const subject = 'IronTrack account confirmation';
    const introductoryWelcome = 'Welcome to Iron Track!\nThis email is just to confirm your account registration for your records.';
    const contactReference = '\nIf you have any questions, feel free to respond to this.';
    const message = introductoryWelcome + contactReference;

    try{
        let postMail = await postman.sendMail({
            from: 'calhounbryce13@gmail.com',
            to: email,
            subject: subject,
            text: message
        })
    }catch(error){
        console.log(error);
    }

}

const login_user = function(session, email){
    session.loggedIn = true;
    session.user = email;
}

const logout_user = function(session){
    session.loggedIn = false;
    session.user = '';
}

const valid_user_session = function(req){
    if(req.session){
        if(req.session.loggedIn){
            return true;
        }
    }
    return false;
}

/////////////////////////////////////////////////////////////////////////////////////////////



app.post('/login', async(req, res)=>{
    const {email, password} = req.body;
    if(exercises.user_already_exists(email)){
        const user = await exercises.get_user_data(email);    
        if(user){
            const hashedPassword = user.password;
            if(bcrypt.compare(password, hashedPassword)){
                login_user(req.session, email);
                console.log(email," is logged in!");
                console.log(req.session);
                res.status(200).json({"Success": "User logged into registered account"});
                return;
            }
            res.status(400).json({"Error":"Invalid user password"})
            return;
        }
        res.status(500).json({"Error":"Internal server error while fetching user's password"});
        return;
    }
    res.status(404).json({"Error":"Invalid user login attempt, user NOT FOUND"});
});

app.post('/registration', async(req, res)=>{
    let {email, password} = req.body;
    if(email && password){
        password = await bcrypt.hash(password, 10);
        try{
            let madeNewUser = await exercises.create_new_user(email, password);
            if(!madeNewUser){
                res.status(400).json({"Error":"User already exists"});
                return;
            }
            res.status(201).json(madeNewUser);
            send_confirmation_email(email);
            return;
        }catch(error){
            console.log(error);
            res.status(500).json({"Error":"Internal server error"});
            return;
        }
    }
    res.status(400).json({"Error":"Invalid request"});
});

app.post('/exercises', asyncHandler(async(req, res)=>{
    if(valid_user_session(req)){
        const email = req.session.user;
        if(validate_request_body(req.body)){
            const {name, reps, weight, unit, date} = req.body;
        
            let newEntry = await exercises.add_new_exercise(email, name, reps, weight, unit, date);
            if(newEntry){
                res.status(201).json(newEntry);
                return;
            }
            res.status(500).json({"Error":"Internal Server Error"});
            return;
        }
        res.status(400).json({"Error": "Invalid request"});
        return;
    }
    res.status(400).json({"Error":"Invalid user sesison"});
}));

app.get('/exercises', asyncHandler(async(req, res)=>{
    console.log(req.session);
    if(valid_user_session(req)){
        const email = req.session.user;
        try{
            let userData = await exercises.get_all_exercises(email);
            if(userData){
                res.status(200).json(userData);
                return;
            }
            res.status(500).json({"Error":"Internal Server Error"});
        }catch(error){
            res.status(500).json({"Error": "Internal Server Error"});
        }
        return;
    }
    res.status(400).json({"Error":"Invalid user session"});
}));

app.get('/exercises/:_id', asyncHandler(async(req, res)=>{
    const id = req.params._id;
    let data = await exercises.get_by_id(id);
    if(data){
        res.status(200).json(data);
        return;
    }
    res.status(404).json({"Error": "Not found"});
}));

app.put('/exercises/:_id', asyncHandler(async(req, res)=>{
    if(validate_request_body(req.body)){
        const id = req.params._id;
        let updated;
        try{
            updated = await exercises.update_by_id(id, req.body);
        }catch(error){
            console.log(error);
            res.status(500).json({"Error":"Internal server error"});
            return;
        }
        if(updated){
            res.status(200).json(updated);
            return;
        }
        res.status(404).json({"Error": "Not found"});
        return;
    }
    res.status(400).json({"Error":"Invalid request"});
}));

app.delete('/exercises/:_id', asyncHandler(async(req, res)=>{
    if(req.params._id){
        let deleted = false;
        try{
            deleted = await exercises.delete_by_id(req.params._id);
        }catch(error){
            res.status(500).json({"Error":"Internal server error"});
            return;
        }
        console.log(deleted);
        if(deleted){
            res.status(204).json({"Success":"Entry removed"});
            return;
        }
        res.status(404).json({"Error": "Not found"});
        return;
    }
    res.status(400).json({"Erorr":"Bad request"});


}));

app.listen(PORT, async () => {
    await exercises.connect()
    console.log(`Server listening on port ${PORT}...`);
});
