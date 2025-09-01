const axios = require('axios');
const { AppError } = require('../errors/app.error');

const makeHttpRequest = async ({ method, url, data, headers }) => {
  try {
    const response = await axios({ method, url, data, headers });
    return response.data;
  } catch (error) {
    throw new AppError(`HTTP request failed: ${error.message}`, error.response?.status || 500);
  }
};

module.exports = { makeHttpRequest };