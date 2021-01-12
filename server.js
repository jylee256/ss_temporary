const express = require('express')
const app = express()
const ejs = require('ejs')
const bodyParser = require('body-parser')


app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile)
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.listen(5000, () => {
    console.log('server is listening at localhost:5000')
})

app.get("/", function(req,res) {
    res.render("login.html", {});
    //res.render("test1", {});
});

app.post("/postTest", function(req,res) {
    console.log(req.body);
    res.render("test2", {});
    //res.json({ok:true});
})