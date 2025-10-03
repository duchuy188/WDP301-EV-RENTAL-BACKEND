const axios = require('axios');

class ExternalAPIs {

  // OpenWeatherMap API
  static async getWeather(city = 'Ho Chi Minh') {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );
      return {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        weather: response.data.weather[0].main,
        description: response.data.weather[0].description,
        windSpeed: response.data.wind.speed,
        city: response.data.name
      };
    } catch (error) {
      console.error('Weather API error:', error);
      return null;
    }
  }

  // Google Calendar API - Disabled
  static async getCalendarEvents() {
    console.log('Google Calendar API disabled - returning empty array');
    return [];
  }

  // Eventbrite API - Disabled
  static async getEvents() {
    console.log('Eventbrite API disabled - returning empty array');
    return [];
  }

  // Lấy dữ liệu thời tiết 5 ngày
  static async getWeatherForecast(city = 'Ho Chi Minh') {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );
      return response.data.list.slice(0, 5).map(item => ({
        date: item.dt_txt,
        temperature: item.main.temp,
        weather: item.weather[0].main,
        description: item.weather[0].description,
        humidity: item.main.humidity
      }));
    } catch (error) {
      console.error('Weather Forecast API error:', error);
      return [];
    }
  }

  // Lấy tất cả dữ liệu external
  static async getAllExternalData() {
    try {
      const [weather, events, calendar, forecast] = await Promise.all([
        this.getWeather(),
        this.getEvents(),
        this.getCalendarEvents(),
        this.getWeatherForecast()
      ]);

      return {
        weather,
        events,
        calendar,
        forecast,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting external data:', error);
      return {
        weather: null,
        events: [],
        calendar: [],
        forecast: [],
        timestamp: new Date()
      };
    }
  }
}

module.exports = ExternalAPIs;