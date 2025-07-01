/**
 * Author: Bryce Calhoun
 * Description: Backend model file for IronTrack's REACT frontend, utilizing mongoose API to interact with 
 *              NoSQL database.
 */
import mongoose from 'mongoose';
import 'dotenv/config';

let connection = undefined;


const exerciseSchema = new mongoose.Schema({
    name: String,
    reps: Number,
    weight: Number,
    unit: String,
    date: String
});


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    exercises: [exerciseSchema]
});


const userModel = new mongoose.model('Exercises', userSchema, 'user-data');

const create_new_user = async(email, hashedPassword)=>{
    console.log(await userModel.find({email: email}));
    if((await userModel.find({email: email})).length > 0) return false;
    const newUser = userModel({email:email, password:hashedPassword, exercises:[]});
    return await newUser.save();
}

const get_user_data = async(email) =>{
    try{
        const user = await userModel.find({email: email});
        return user[0];
    }catch(error){
        console.log(error);
    }
    return false;    
}


const user_already_exists = async(email)=>{
    const documents = await userModel.find({email:email});
    if(documents.length > 0) return true;
    return false;
}

const add_new_exercise = async(email, name, reps, weight, unit, date)=>{
    let user = await userModel.find({email:email});
    if(user){
        const newEntry = {
            name: name,
            reps: reps,
            weight: weight,
            unit: unit,
            date: date
        }
        user = user[0];
        let updatedExercises = user.exercises;
        updatedExercises.push(newEntry);
        user.exercises = updatedExercises;
        return await user.save();
    }
    return false;
}

const get_all_exercises = async(email)=>{
    const user = await userModel.find({email:email});
    if(user){
        return user[0].exercises;
    }
    return false;
}

const get_by_id = async(id)=>{
    /*
    success: object with exercise properties
    fail: NULL
     */
    try{
        return await userModel.findById(id);
    }catch(error){
        console.log(error);
        return null;
    }
}

const update_by_id = async(id, update)=>{
    if((await get_by_id(id)) == null){
        return false;
    }
    const filter = {_id:id};
    return await userModel.findOneAndUpdate(filter, update, {new:true});
}

const delete_by_id = async(id)=>{
    console.log("here");
    let deleted = false;
    try{
        deleted = await userModel.findByIdAndDelete(id);
    }catch(error){
        console.log(error);
        return false;
    }
    console.log(deleted);
    if(deleted == null){
        return false;
    }
    return true;
}


/**
 * This function connects to the MongoDB server and to the database
 *  'exercise_db' in that server.
 */
async function connect(){
    try{
        connection = await mongoose.connect(process.env.MONGODB_CONNECT_STRING);
        console.log("Successfully connected to MongoDB using Mongoose!");
    } catch(err){
        console.log(err);
        throw Error(`Could not connect to MongoDB ${err.message}`)
    }
}



export { connect, add_new_exercise, get_by_id, get_all_exercises, update_by_id, delete_by_id, create_new_user, user_already_exists, get_user_data };