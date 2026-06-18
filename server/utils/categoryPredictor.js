const CATEGORY_KEYWORDS = [
  {
    category: 'Food',
    keywords: [/pizza/i, /domino/i, /mcdonald/i, /burger/i, /restaurant/i, /food/i, /cafe/i, /lunch/i, /dinner/i, /breakfast/i, /starbucks/i, /swiggy/i, /zomato/i, /grocery/i, /groceries/i, /eat/i, /subway/i, /kfc/i, /chai/i, /tea/i, /coffee/i]
  },
  {
    category: 'Travel',
    keywords: [/uber/i, /ola/i, /cab/i, /taxi/i, /flight/i, /train/i, /bus/i, /ticket/i, /travel/i, /petrol/i, /fuel/i, /metro/i, /booking/i, /rapido/i, /drive/i, /trip/i, /hotel/i, /stay/i, /airbnb/i]
  },
  {
    category: 'Rent',
    keywords: [/rent/i, /flat/i, /deposit/i, /room/i, /lease/i, /pg/i, /hostel/i, /accommodation/i]
  },
  {
    category: 'Shopping',
    keywords: [/amazon/i, /flipkart/i, /myntra/i, /clothes/i, /shoes/i, /shopping/i, /walmart/i, /mall/i, /zara/i, /hm/i, /purchase/i, /gift/i, /ebay/i]
  },
  {
    category: 'Entertainment',
    keywords: [/netflix/i, /spotify/i, /hotstar/i, /prime/i, /movie/i, /cinema/i, /concert/i, /game/i, /gaming/i, /steam/i, /playstation/i, /pub/i, /bar/i, /club/i, /drinks/i, /beer/i, /party/i, /show/i, /theater/i, /event/i]
  },
  {
    category: 'Utilities',
    keywords: [/electricity/i, /water/i, /gas/i, /internet/i, /wifi/i, /recharge/i, /broadband/i, /trash/i, /phone/i, /mobile/i, /bill/i, /dth/i, /power/i]
  },
  {
    category: 'Healthcare',
    keywords: [/doctor/i, /hospital/i, /medicine/i, /pharmacy/i, /clinic/i, /dental/i, /health/i, /gym/i, /fitness/i, /supplement/i, /medical/i, /therapy/i, /insurance/i]
  },
  {
    category: 'Education',
    keywords: [/book/i, /course/i, /tuition/i, /school/i, /college/i, /fee/i, /udemy/i, /coursera/i, /training/i, /exam/i, /stationery/i, /class/i]
  }
];

/**
 * Predicts the category of an expense based on its description text.
 * @param {string} description - The expense description
 * @returns {string} The predicted category
 */
export const predictCategory = (description) => {
  if (!description) return 'Others';

  const cleanDesc = description.trim().toLowerCase();

  for (const item of CATEGORY_KEYWORDS) {
    for (const regex of item.keywords) {
      if (regex.test(cleanDesc)) {
        return item.category;
      }
    }
  }

  return 'Others';
};
