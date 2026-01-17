// Flutter 코인 경제 시스템
// pubspec.yaml에 추가 필요:
// dependencies:
//   google_mobile_ads: ^5.0.0
//   in_app_purchase: ^3.2.0
//   http: ^1.1.0

import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

final uuid = Uuid();

// ==================== 모델 ====================

class Wallet {
  final int coins;
  final DateTime updatedAt;

  Wallet({required this.coins, required this.updatedAt});

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      coins: json['coins'] as int,
      updatedAt: DateTime.parse(json['updated_at']),
    );
  }
}

class Transaction {
  final String id;
  final String type;
  final int amount;
  final String source;
  final DateTime createdAt;

  Transaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.source,
    required this.createdAt,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      type: json['type'] as String,
      amount: json['amount'] as int,
      source: json['source'] as String,
      createdAt: DateTime.parse(json['created_at']),
    );
  }
}

class ShopItem {
  final String id;
  final String name;
  final String description;
  final String category;
  final int priceCoins;

  ShopItem({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.priceCoins,
  });

  factory ShopItem.fromJson(Map<String, dynamic> json) {
    return ShopItem(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      category: json['category'] as String,
      priceCoins: json['price_coins'] as int,
    );
  }
}

// ==================== API 서비스 ====================

class CoinEconomyService {
  final String baseUrl;
  final String? accessToken;

  CoinEconomyService({required this.baseUrl, this.accessToken});

  Future<Wallet?> getWallet() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/rest/v1/user_wallets?select=*'),
        headers: {
          'apikey': accessToken ?? '',
          'Authorization': 'Bearer ${accessToken ?? ''}',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data is List && data.isNotEmpty) {
          return Wallet.fromJson(data[0]);
        }
      }
      return null;
    } catch (e) {
      print('Get wallet error: $e');
      return null;
    }
  }

  Future<List<Transaction>> getTransactions({int limit = 50}) async {
    try {
      final response = await http.get(
        Uri.parse(
            '$baseUrl/rest/v1/coin_transactions?select=*&order=created_at.desc&limit=$limit'),
        headers: {
          'apikey': accessToken ?? '',
          'Authorization': 'Bearer ${accessToken ?? ''}',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as List;
        return data.map((json) => Transaction.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      print('Get transactions error: $e');
      return [];
    }
  }

  Future<List<ShopItem>> getShopItems() async {
    try {
      final response = await http.get(
        Uri.parse(
            '$baseUrl/rest/v1/shop_items?select=*&is_active=eq.true&order=price_coins.asc'),
        headers: {
          'apikey': accessToken ?? '',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as List;
        return data.map((json) => ShopItem.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      print('Get shop items error: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>> claimRewarded({
    required String claimKey,
    required int rewardCoins,
    String? adUnit,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/coins/claim-rewarded'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${accessToken ?? ''}',
        },
        body: json.encode({
          'claim_key': claimKey,
          'reward_coins': rewardCoins,
          'ad_unit': adUnit,
        }),
      );

      return json.decode(response.body);
    } catch (e) {
      print('Claim rewarded error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> buyItem({
    required String itemId,
    required int quantity,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/coins/buy-item'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${accessToken ?? ''}',
        },
        body: json.encode({
          'item_id': itemId,
          'quantity': quantity,
        }),
      );

      return json.decode(response.body);
    } catch (e) {
      print('Buy item error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> grantIAP({
    required String productId,
    required String purchaseToken,
    required String platform,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/coins/grant-iap'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${accessToken ?? ''}',
        },
        body: json.encode({
          'product_id': productId,
          'purchase_token': purchaseToken,
          'platform': platform,
        }),
      );

      return json.decode(response.body);
    } catch (e) {
      print('Grant IAP error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<int> getDailyClaimsRemaining() async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/rest/v1/rpc/rpc_get_daily_claims_remaining'),
        headers: {
          'apikey': accessToken ?? '',
          'Authorization': 'Bearer ${accessToken ?? ''}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return json.decode(response.body) as int;
      }
      return 0;
    } catch (e) {
      print('Get daily claims remaining error: $e');
      return 0;
    }
  }
}

// ==================== Rewarded Ad 관리 ====================

class RewardedAdManager {
  RewardedAd? _rewardedAd;
  bool _isAdReady = false;

  void loadAd(String adUnitId) {
    RewardedAd.load(
      adUnitId: adUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewardedAd = ad;
          _isAdReady = true;
          print('Rewarded ad loaded');
        },
        onAdFailedToLoad: (error) {
          print('Rewarded ad failed to load: $error');
          _isAdReady = false;
        },
      ),
    );
  }

  Future<bool> showAd({
    required Function(String claimKey, int rewardCoins) onRewarded,
    String? adUnit,
  }) async {
    if (!_isAdReady || _rewardedAd == null) {
      print('Ad not ready');
      return false;
    }

    final completer = Completer<bool>();

    _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _isAdReady = false;
        loadAd(adUnit ?? 'ca-app-pub-3940256099942544/5224354917'); // 테스트 ID
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        ad.dispose();
        _isAdReady = false;
        completer.complete(false);
      },
    );

    _rewardedAd!.show(
      onUserEarnedReward: (ad, reward) {
        // 보상 지급
        final claimKey = 'claim_${DateTime.now().millisecondsSinceEpoch}_${uuid.v4()}';
        onRewarded(claimKey, reward.amount.toInt());
        completer.complete(true);
      },
    );

    return completer.future;
  }
}

// ==================== IAP 관리 ====================

class IAPManager {
  final InAppPurchase _iap = InAppPurchase.instance;
  final CoinEconomyService _service;
  final String platform;

  IAPManager({required CoinEconomyService service, required this.platform})
      : _service = service;

  // 코인 패키지 상품 ID
  static const List<String> coinProducts = [
    'coins_100',
    'coins_500',
    'coins_1000',
    'coins_5000',
  ];

  Future<List<ProductDetails>> getProducts() async {
    final bool available = await _iap.isAvailable();
    if (!available) {
      print('IAP not available');
      return [];
    }

    final ProductDetailsResponse response =
        await _iap.queryProductDetails(coinProducts.toSet());

    return response.productDetails;
  }

  Future<bool> buyProduct(ProductDetails product) async {
    final PurchaseParam purchaseParam = PurchaseParam(
      productDetails: product,
    );

    final bool success = await _iap.buyNonConsumable(purchaseParam: purchaseParam);

    if (success) {
      // 구매 완료 대기
      _iap.purchaseStream.listen((purchases) {
        for (final purchase in purchases) {
          _handlePurchase(purchase);
        }
      });
    }

    return success;
  }

  Future<void> _handlePurchase(PurchaseDetails purchase) async {
    if (purchase.status == PurchaseStatus.purchased) {
      // 서버에 검증 요청
      final result = await _service.grantIAP(
        productId: purchase.productID,
        purchaseToken: purchase.verificationData.source == 'app_store'
            ? purchase.verificationData.serverVerificationData
            : purchase.verificationData.localVerificationData,
        platform: platform,
      );

      if (result['success'] == true) {
        // 구매 완료 처리
        if (purchase.pendingCompletePurchase != null) {
          await _iap.completePurchase(purchase);
        }
      } else {
        print('IAP grant failed: ${result['error']}');
      }
    }
  }
}

// ==================== UI 위젯 ====================

// Wallet 페이지
class WalletPage extends StatefulWidget {
  final CoinEconomyService service;

  const WalletPage({Key? key, required this.service}) : super(key: key);

  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  Wallet? _wallet;
  List<Transaction> _transactions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final wallet = await widget.service.getWallet();
    final transactions = await widget.service.getTransactions();
    setState(() {
      _wallet = wallet;
      _transactions = transactions;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('코인 지갑')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // 코인 잔액
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '코인 잔액',
                            style: TextStyle(
                              fontSize: 16,
                              color: Colors.grey,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${_wallet?.coins ?? 0} 코인',
                            style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // 거래 내역
                  const Text(
                    '거래 내역',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _transactions.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32),
                            child: Text('거래 내역이 없습니다.'),
                          ),
                        )
                      : ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _transactions.length,
                          itemBuilder: (context, index) {
                            final tx = _transactions[index];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                title: Text(_getTransactionLabel(tx)),
                                subtitle: Text(
                                  _formatDate(tx.createdAt),
                                  style: const TextStyle(fontSize: 12),
                                ),
                                trailing: Text(
                                  '${tx.type == 'spend' ? '-' : '+'}${tx.amount}',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: tx.type == 'spend'
                                        ? Colors.red
                                        : Colors.green,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ],
              ),
            ),
    );
  }

  String _getTransactionLabel(Transaction tx) {
    if (tx.type == 'earn') return '광고 보상';
    if (tx.type == 'iap') return '코인 구매';
    return '아이템 구매';
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}

// Earn 페이지
class EarnPage extends StatefulWidget {
  final CoinEconomyService service;
  final RewardedAdManager adManager;

  const EarnPage({
    Key? key,
    required this.service,
    required this.adManager,
  }) : super(key: key);

  @override
  State<EarnPage> createState() => _EarnPageState();
}

class _EarnPageState extends State<EarnPage> {
  int _remainingClaims = 0;
  Wallet? _wallet;
  bool _isLoading = true;
  bool _isClaiming = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final remaining = await widget.service.getDailyClaimsRemaining();
    final wallet = await widget.service.getWallet();
    setState(() {
      _remainingClaims = remaining;
      _wallet = wallet;
      _isLoading = false;
    });
  }

  Future<void> _watchAd() async {
    if (_remainingClaims <= 0 || _isClaiming) return;

    setState(() => _isClaiming = true);

    final success = await widget.adManager.showAd(
      onRewarded: (claimKey, rewardCoins) async {
        final result = await widget.service.claimRewarded(
          claimKey: claimKey,
          rewardCoins: rewardCoins,
        );

        if (mounted) {
          if (result['success'] == true) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('${rewardCoins} 코인을 받았습니다!')),
            );
            _loadData();
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('보상 받기 실패: ${result['error']}')),
            );
          }
        }
      },
    );

    setState(() => _isClaiming = false);

    if (!success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('광고 로드 실패')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('코인 획득')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // 코인 잔액
                  Card(
                    color: Colors.amber.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          const Text(
                            '광고 보고 코인 받기',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            '+10 코인',
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              color: Colors.amber,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '오늘 남은 횟수: $_remainingClaims회',
                            style: const TextStyle(fontSize: 16),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed:
                                _remainingClaims > 0 && !_isClaiming
                                    ? _watchAd
                                    : null,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 48,
                                vertical: 16,
                              ),
                            ),
                            child: _isClaiming
                                ? const CircularProgressIndicator()
                                : Text(_remainingClaims > 0
                                    ? '광고 시청하기'
                                    : '오늘의 횟수 소진'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

// Shop 페이지
class ShopPage extends StatefulWidget {
  final CoinEconomyService service;

  const ShopPage({Key? key, required this.service}) : super(key: key);

  @override
  State<ShopPage> createState() => _ShopPageState();
}

class _ShopPageState extends State<ShopPage> {
  List<ShopItem> _items = [];
  Wallet? _wallet;
  bool _isLoading = true;
  String? _buyingItemId;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final items = await widget.service.getShopItems();
    final wallet = await widget.service.getWallet();
    setState(() {
      _items = items;
      _wallet = wallet;
      _isLoading = false;
    });
  }

  Future<void> _buyItem(ShopItem item) async {
    if (_wallet == null || _wallet!.coins < item.priceCoins) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('코인이 부족합니다.')),
      );
      return;
    }

    setState(() => _buyingItemId = item.id);

    final result = await widget.service.buyItem(
      itemId: item.id,
      quantity: 1,
    );

    if (mounted) {
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('구매 완료!')),
        );
        _loadData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('구매 실패: ${result['error']}')),
        );
      }
    }

    setState(() => _buyingItemId = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('상점'),
        actions: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Center(
              child: Text(
                '${_wallet?.coins ?? 0} 코인',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                ),
                itemCount: _items.length,
                itemBuilder: (context, index) {
                  final item = _items[index];
                  final isBuying = _buyingItemId == item.id;
                  final canBuy = _wallet != null &&
                      _wallet!.coins >= item.priceCoins &&
                      !isBuying;

                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            item.description,
                            style: const TextStyle(fontSize: 12),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const Spacer(),
                          Text(
                            '${item.priceCoins} 코인',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.teal,
                            ),
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: canBuy ? () => _buyItem(item) : null,
                              child: isBuying
                                  ? const CircularProgressIndicator()
                                  : const Text('구매'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

// Buy Coins 페이지 (IAP)
class BuyCoinsPage extends StatefulWidget {
  final CoinEconomyService service;
  final IAPManager iapManager;

  const BuyCoinsPage({
    Key? key,
    required this.service,
    required this.iapManager,
  }) : super(key: key);

  @override
  State<BuyCoinsPage> createState() => _BuyCoinsPageState();
}

class _BuyCoinsPageState extends State<BuyCoinsPage> {
  List<ProductDetails> _products = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    setState(() => _isLoading = true);
    final products = await widget.iapManager.getProducts();
    setState(() {
      _products = products;
      _isLoading = false;
    });
  }

  Future<void> _buyProduct(ProductDetails product) async {
    final success = await widget.iapManager.buyProduct(product);
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('구매 처리 중...')),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('구매 실패')),
      );
    }
  }

  int _getCoinsFromProductId(String productId) {
    final coinMap = {
      'coins_100': 100,
      'coins_500': 500,
      'coins_1000': 1000,
      'coins_5000': 5000,
    };
    return coinMap[productId] ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('코인 구매')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: _products.map((product) {
                final coins = _getCoinsFromProductId(product.id);
                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.title,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(product.description),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '$coins 코인',
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.teal,
                              ),
                            ),
                            Text(
                              product.price,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => _buyProduct(product),
                            child: const Text('구매하기'),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
    );
  }
}

