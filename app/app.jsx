var Promise = require('bluebird');
var React = require('react');
var ReactDOM = require('react-dom');
var RecipeList = require('./components/RecipeList.jsx');
var ListChooser = require('./components/ListChooser.jsx');

var authenticator = require('./authenticator.js');
var filePicker = require('./drive-picker.js');
var downloader = require('./drive-document-downloader.js');
var recipeManager = require('./recipe-manager.js');

var wunderlist = require('./wunderlist.js');;
var parser = require('./recipe-parser.js');

// --- Generate these yourself if forking this project ---
var wunderlistClientId = '950a881bc370b266e57d';
var googleDeveloperKey = 'AIzaSyDIDYjtJyFO8uvHs0020b7eH7fromVbS-U';
var googleClientId = '866832706562-g20thf05bjaif1m44fr779is60bjo7v1.apps.googleusercontent.com';
// See wunderlist_token_exchanger.php for example implementation of token.php, you'll need to host this yourself.
var wunderlistTokenExchanger = 'http://flassari.is/wunderlist/token.php';

// Scope for readonly access.
var scope = ['https://www.googleapis.com/auth/drive.readonly'];

var googleAccessToken;
var wunderlistAccessToken;
var shoppingListId;

window.onApiLoaded = function()
{
	wunderlist.logIn(wunderlistClientId, wunderlistTokenExchanger)
	.then(function(accessToken) {
		wunderlistAccessToken = accessToken;
	})
	.then(getShoppingList)
	.then(function(listId) {
		shoppingListId = parseInt(listId);
	})
	.then(getRecipes)
	.then(function(recipes) {
		recipeManager.setRecipes(recipes);
		return recipes;
	})
	.then(showRecipes)
}

function getRecipes()
{
	if (localStorage.recipes)
	{
		return JSON.parse(localStorage.recipes);
	}
	else
	{
		return authenticator.authenticate(googleClientId, scope)
		.then(onAuthenticated)
		.then(function() { return filePicker.pick(googleAccessToken, googleDeveloperKey); })
		.then(function(fileId) { return downloader.download(fileId, googleAccessToken); })
		.then(function(fileContent) {
			var recipes = parser.parse(fileContent);
			localStorage.recipes = JSON.stringify(recipes); // Store on device
			return recipes;
		});
	}
}

function onAuthenticated(authResult)
{
	if (authResult && !authResult.error)
	{
		googleAccessToken = authResult.access_token;
		return Promise.resolve();
	}
	return Promise.reject();
}

function getShoppingList()
{
	if (localStorage.shoppingList)
	{
		return localStorage.shoppingList;
	}

	return wunderlist.getLists(wunderlistClientId, wunderlistAccessToken)
	.then(function(lists) {
		return new Promise(function( resolve, reject) {
			ReactDOM.render(<ListChooser lists={lists} done={resolve}/>, document.getElementById('main'));
		});
	}).then(function(listId) {
		localStorage.shoppingList = listId;
		return listId;
	});
}

function showRecipes(recipes)
{
	ReactDOM.render(<RecipeList recipes={recipes} clicked={addRecipeToWunderlist}/>, document.getElementById('main'));
}

function addRecipeToWunderlist(recipeId)
{
	recipeManager.setRecipeInProgress(recipeId, true);
	console.log("Adding recipe.");

	var recipe = recipeManager.recipesById[recipeId];

	wunderlist.addItems(shoppingListId, recipe.ingredients, wunderlistClientId, wunderlistAccessToken)
	.then(function() {
		console.log("Recipe added.");
		recipeManager.setRecipeInProgress(recipeId, false);
	});
}